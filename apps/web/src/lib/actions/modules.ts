"use server";

import { DISTANCE_METERS } from "@runner360/training-engine";
import {
  competitionResultSchema,
  competitionSchema,
  fieldErrors,
  formDataToObject,
  hydrationLogSchema,
  hydrationReminderSchema,
} from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { canUseFeature, requireOnboardedSession } from "@/lib/auth";
import { logError } from "@/lib/log";

const PREMIUM_REQUIRED: ActionState = { ok: false, message: "Esta función está incluida en Premium." };

// ----------------------------- Hidratación -----------------------------

export async function addHydrationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOnboardedSession();
  if (!(await canUseFeature(session, "hydration"))) return PREMIUM_REQUIRED;
  const parsed = hydrationLogSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { error } = await session.supabase.from("hydration_logs").insert({
    user_id: session.user.id,
    log_date: v.logDate,
    beverage: v.beverage,
    context: v.context,
    volume_ml: v.volumeMl,
    carbs_g: v.carbsG,
    notes: v.notes,
  });
  if (error) {
    logError("hydration", error);
    return { ok: false, message: "No pudimos guardar el registro." };
  }
  revalidatePath("/hidratacion");
  return { ok: true, message: "Registro guardado." };
}

export async function deleteHydrationAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("hydration_logs").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/hidratacion");
}

export async function addReminderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOnboardedSession();
  if (!(await canUseFeature(session, "hydration"))) return PREMIUM_REQUIRED;
  const parsed = hydrationReminderSchema.safeParse({ ...formDataToObject(formData, ["weekdays"]), enabled: "on" });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { error } = await session.supabase.from("hydration_reminders").insert({
    user_id: session.user.id,
    label: parsed.data.label,
    time_of_day: parsed.data.timeOfDay,
    weekdays: parsed.data.weekdays,
    enabled: true,
  });
  if (error) return { ok: false, message: "No pudimos guardar el recordatorio." };
  revalidatePath("/hidratacion");
  return { ok: true, message: "Recordatorio guardado." };
}

export async function toggleReminderAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  const id = z.uuid().safeParse(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  if (id.success) await supabase.from("hydration_reminders").update({ enabled }).eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/hidratacion");
}

export async function deleteReminderAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("hydration_reminders").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/hidratacion");
}

// ----------------------------- Competencias -----------------------------

export async function addCompetitionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOnboardedSession();
  if (!(await canUseFeature(session, "competitions"))) return PREMIUM_REQUIRED;
  const raw = formDataToObject(formData);
  // Si elige una distancia estándar, se usa la distancia oficial.
  if (typeof raw.distanceCode === "string" && raw.distanceCode in DISTANCE_METERS && !raw.distanceKm) {
    raw.distanceKm = String(Math.floor(DISTANCE_METERS[raw.distanceCode as keyof typeof DISTANCE_METERS]) / 1000);
  }
  const parsed = competitionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { data: active } = await session.supabase.from("user_training_plans").select("id").eq("user_id", session.user.id).eq("status", "active").maybeSingle<{ id: string }>();
  const { error } = await session.supabase.from("competitions").insert({
    user_id: session.user.id,
    name: v.name,
    distance_code: v.distanceCode,
    distance_m: v.distanceKm,
    event_date: v.eventDate,
    location: v.location,
    target_time_s: v.targetTime,
    user_plan_id: active?.id ?? null,
    notes: v.notes,
  });
  if (error) {
    logError("competition", error);
    return { ok: false, message: "No pudimos guardar la competencia." };
  }
  revalidatePath("/competencias");
  return { ok: true, message: "Competencia guardada." };
}

export async function saveResultAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOnboardedSession();
  if (!(await canUseFeature(session, "competitions"))) return PREMIUM_REQUIRED;
  const { supabase, user } = session;
  const raw = formDataToObject(formData);
  const status = raw.status === "dnf" || raw.status === "dns" ? raw.status : "completed";
  const competitionId = z.uuid().safeParse(raw.competitionId);
  if (!competitionId.success) return { ok: false, message: "Competencia inválida." };

  if (status !== "completed") {
    await supabase.from("competitions").update({ status }).eq("id", competitionId.data).eq("user_id", user.id);
    revalidatePath("/competencias");
    return { ok: true, message: "Estado actualizado." };
  }

  const parsed = competitionResultSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const { data: comp } = await supabase.from("competitions").select("id, distance_m").eq("id", v.competitionId).eq("user_id", user.id).maybeSingle<{ id: string; distance_m: number }>();
  if (!comp) return { ok: false, message: "Competencia inexistente." };
  if (v.splits && v.splits.length !== Math.ceil(comp.distance_m / 1000)) {
    return { ok: false, errors: { splits: `Cargá ${Math.ceil(comp.distance_m / 1000)} parciales (uno por km).` } };
  }
  if (v.splits && v.splits.reduce((a, b) => a + b, 0) !== v.finishTime) {
    return { ok: false, errors: { splits: "La suma de los parciales no coincide con el tiempo final." } };
  }

  const { data: result, error } = await supabase
    .from("competition_results")
    .upsert({ competition_id: comp.id, user_id: user.id, finish_time_s: v.finishTime, is_official: v.isOfficial, notes: v.notes }, { onConflict: "competition_id" })
    .select("id")
    .single<{ id: string }>();
  if (error || !result) {
    logError("result", error);
    return { ok: false, message: "No pudimos guardar el resultado." };
  }
  await supabase.from("competitions").update({ status: "completed" }).eq("id", comp.id);
  await supabase.from("competition_splits").delete().eq("result_id", result.id);
  if (v.splits && v.splits.length) {
    let cumT = 0;
    const rows = v.splits.map((s, i) => {
      cumT += s;
      return { result_id: result.id, user_id: user.id, split_index: i + 1, cumulative_distance_m: Math.min((i + 1) * 1000, comp.distance_m), cumulative_time_s: cumT };
    });
    await supabase.from("competition_splits").insert(rows);
  }
  revalidatePath("/competencias");
  revalidatePath("/progreso");
  return { ok: true, message: "Resultado guardado." };
}

export async function deleteCompetitionAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (id.success) await supabase.from("competitions").delete().eq("id", id.data).eq("user_id", user.id);
  revalidatePath("/competencias");
}
