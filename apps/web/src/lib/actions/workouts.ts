"use server";

import { fieldErrors, formDataToObject, splitsToRows, todayIn, workoutLogSchema, zonedDateTimeToIso } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { logError } from "@/lib/log";

export async function saveWorkoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = workoutLogSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Revisá los campos marcados." };
  const v = parsed.data;
  if (v.workoutDate > todayIn(profile.timezone)) return { ok: false, errors: { workoutDate: "No podés registrar entrenamientos futuros" } };

  if (v.calendarEntryId) {
    const { data: entry } = await supabase.from("user_training_calendar").select("id").eq("id", v.calendarEntryId).eq("user_id", user.id).maybeSingle();
    if (!entry) return { ok: false, message: "La sesión planificada no existe." };
    const { data: dup } = await supabase.from("workout_logs").select("id").eq("calendar_entry_id", v.calendarEntryId).maybeSingle();
    if (dup) return { ok: false, message: "Esa sesión ya tiene un registro. Podés eliminarlo desde el historial y volver a cargarlo." };
  }

  const skipped = v.status === "skipped";
  const { data: workout, error } = await supabase
    .from("workout_logs")
    .insert({
      user_id: user.id,
      calendar_entry_id: v.calendarEntryId,
      workout_date: v.workoutDate,
      started_at: v.startTime ? zonedDateTimeToIso(v.workoutDate, v.startTime, profile.timezone) : null,
      status: v.status,
      distance_m: skipped ? null : v.distanceKm,
      duration_s: skipped ? null : v.duration,
      avg_hr: skipped ? null : v.avgHr,
      max_hr: skipped ? null : v.maxHr,
      elevation_gain_m: skipped ? null : v.elevationGainM,
      rpe: skipped ? null : v.rpe,
      pain_reported: v.painReported,
      comments: v.comments,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !workout) {
    logError("saveWorkout", error);
    return { ok: false, message: "No pudimos guardar el entrenamiento." };
  }

  if (!skipped && v.splits && v.splits.length > 0 && v.distanceKm) {
    const rows = splitsToRows(v.distanceKm, v.splits).map((r) => ({
      workout_id: workout.id,
      user_id: user.id,
      split_index: r.splitIndex,
      distance_m: r.distanceM,
      duration_s: r.durationS,
    }));
    const { error: sErr } = await supabase.from("workout_splits").insert(rows);
    if (sErr) logError("saveWorkout:splits", sErr);
  }

  revalidatePath("/", "layout");
  redirect("/entrenamientos?guardado=1");
}

export async function deleteWorkoutAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("workout_logs").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/", "layout");
}
