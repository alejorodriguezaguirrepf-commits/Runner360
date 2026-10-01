"use server";
import { redirect } from "next/navigation";
import { parseDuration, parseKmToMeters, workoutLogSchema } from "@runner360/shared";
import { getViewer } from "@/lib/auth";
import { localInputToIso } from "@/lib/datetime";
import { dbErrorState, intOrNull, str, strOrNull, zodToState, type ActionState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

function parseSplits(fd: FormData) {
  const kms = fd.getAll("splitKm").map(String);
  const times = fd.getAll("splitTime").map(String);
  const out: { distanceM: number; durationS: number }[] = [];
  for (let i = 0; i < Math.min(kms.length, times.length); i++) {
    if (!kms[i]!.trim() && !times[i]!.trim()) continue;
    out.push({ distanceM: parseKmToMeters(kms[i]!) ?? Number.NaN, durationS: parseDuration(times[i]!) ?? Number.NaN });
  }
  return out;
}

export async function saveWorkoutAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Tu sesión expiró. Volvé a ingresar." };

  const status = str(fd, "status");
  const km = str(fd, "distanceKm");
  const dur = str(fd, "duration");
  const input = {
    startedAt: localInputToIso(str(fd, "startedAt"), intOrNull(fd, "tzOffset")) ?? "",
    distanceM: km === "" ? 0 : (parseKmToMeters(km) ?? Number.NaN),
    durationS: dur === "" ? 0 : (parseDuration(dur) ?? Number.NaN),
    avgHr: intOrNull(fd, "avgHr"),
    maxHr: intOrNull(fd, "maxHr"),
    elevationGainM: intOrNull(fd, "elevationGainM"),
    rpe: intOrNull(fd, "rpe"),
    notes: strOrNull(fd, "notes"),
    calendarEntryId: strOrNull(fd, "calendarEntryId"),
    status,
    splits: status === "skipped" ? [] : parseSplits(fd),
  };
  const parsed = workoutLogSchema.safeParse(input);
  if (!parsed.success) return zodToState(parsed.error);
  const w = parsed.data;
  if (new Date(w.startedAt).getTime() > Date.now() + 5 * 60_000) {
    return { ok: false, message: "La fecha no puede ser futura.", fieldErrors: { startedAt: "La fecha no puede ser futura" } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      user_id: viewer.id,
      started_at: w.startedAt,
      distance_m: w.status === "skipped" ? 0 : w.distanceM,
      duration_s: w.status === "skipped" ? 0 : w.durationS,
      avg_hr: w.avgHr,
      max_hr: w.maxHr,
      elevation_gain_m: w.elevationGainM,
      rpe: w.rpe,
      notes: w.notes,
      status: w.status,
      calendar_entry_id: w.calendarEntryId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, message: "Esa sesión del plan ya tiene un registro." };
    return dbErrorState("workout.insert", error);
  }
  if (w.splits.length > 0) {
    const { error: sErr } = await supabase.from("workout_splits").insert(
      w.splits.map((s, i) => ({ workout_id: data.id, user_id: viewer.id, split_index: i + 1, distance_m: s.distanceM, duration_s: s.durationS })),
    );
    if (sErr) {
      await supabase.from("workout_logs").delete().eq("id", data.id);
      return dbErrorState("workout.splits", sErr);
    }
  }
  redirect(`/app/historial?guardado=1`);
}

export async function deleteWorkoutAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");
  const supabase = await createClient();
  const { error } = await supabase.from("workout_logs").delete().eq("id", String(fd.get("id") ?? "")).eq("user_id", viewer.id);
  if (error) console.error("[workout.delete] db_error", error.code);
  redirect("/app/historial?eliminado=1");
}
