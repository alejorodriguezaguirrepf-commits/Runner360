"use server";

import { planDayAt } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { getWeekDays } from "@/lib/data/library";
import { logError } from "@/lib/log";
import { MAX_SPLITS, splitSlots } from "@/lib/session-finish";

/** Ritmos posibles por km: de 2:00 a 30:00 (caminando también vale). */
const MIN_PACE = 120;
const MAX_PACE = 1800;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  distanceM: z.number().int().min(50).max(MAX_SPLITS * 1000),
  /** Un tiempo (s) por tramo de splitSlots(distanceM), o vacío si se carga solo el total. */
  splits: z.array(z.number().int().min(1).max(86400)).max(MAX_SPLITS),
  totalS: z.number().int().min(1).max(172800).optional(),
  rpe: z.number().int().min(1).max(10),
  comment: z.string().trim().max(500).optional(),
});
export type FinishSessionInput = z.input<typeof schema>;
export type FinishSessionResult = { ok: true; workoutId: string } | { ok: false; message: string };

/**
 * "Finalizar sesión" del plan: distancia, parciales por km (o solo el tiempo total) y RPE de la
 * sesión. Guarda el registro del día (o lo actualiza, sin tocar lo demás que ya tenía) y reemplaza
 * sus parciales. Lo ven la persona y su entrenador.
 */
export async function finishSessionAction(input: FinishSessionInput): Promise<FinishSessionResult> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisá los datos de la sesión." };
  const v = parsed.data;
  if (v.date > todayIn(profile.timezone)) return { ok: false, message: "Todavía no llegó ese día." };

  const slots = splitSlots(v.distanceM);
  const withSplits = v.splits.length > 0;
  if (withSplits && v.splits.length !== slots.length) return { ok: false, message: "Completá el tiempo de cada parcial." };
  if (!withSplits && !v.totalS) return { ok: false, message: "Cargá el tiempo total de la sesión." };
  const paces = withSplits ? v.splits.map((s, i) => (s * 1000) / slots[i]!.meters) : [(v.totalS! * 1000) / v.distanceM];
  if (paces.some((p) => p < MIN_PACE || p > MAX_PACE)) return { ok: false, message: "Algún tiempo no parece correcto: revisá los minutos y segundos." };
  const duration = withSplits ? v.splits.reduce((a, s) => a + s, 0) : v.totalS!;

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: "No tenés un plan en curso." };
  const slot = planDayAt(open.enrollment, open.segments, open.plan.duration_weeks, v.date);
  const day = slot ? (await getWeekDays(supabase, open.enrollment.content_version, open.plan.id, slot.planWeek)).find((d) => d.day_index === slot.dayIndex) : null;
  if (!slot || !day || day.is_rest) return { ok: false, message: "Ese día no tiene entrenamiento en tu plan." };

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id, status")
    .eq("enrollment_id", open.enrollment.id)
    .eq("workout_date", v.date)
    .maybeSingle<{ id: string; status: string }>();
  const fields = {
    status: existing?.status === "modified" ? "modified" : "completed",
    distance_m: v.distanceM,
    duration_s: duration,
    rpe: v.rpe,
    ...(v.comment ? { comments: v.comment } : {}),
  };
  const { data: saved, error } = existing
    ? await supabase.from("workout_logs").update(fields).eq("id", existing.id).select("id").single<{ id: string }>()
    : await supabase
        .from("workout_logs")
        .insert({ ...fields, user_id: user.id, enrollment_id: open.enrollment.id, plan_week: slot.planWeek, plan_day_index: slot.dayIndex, workout_date: v.date })
        .select("id")
        .single<{ id: string }>();
  if (error || !saved) {
    logError("finish:save", { code: error?.code });
    return { ok: false, message: "No pudimos guardar la sesión. Probá nuevamente." };
  }

  // Parciales: se reemplazan por los nuevos.
  const { error: delErr } = await supabase.from("workout_splits").delete().eq("workout_id", saved.id);
  if (delErr) logError("finish:splits-delete", { code: delErr.code });
  if (withSplits) {
    const rows = slots.map((s, i) => ({ workout_id: saved.id, user_id: user.id, split_index: s.index, distance_m: s.meters, duration_s: v.splits[i]! }));
    const { error: sErr } = await supabase.from("workout_splits").insert(rows);
    if (sErr) {
      logError("finish:splits", { code: sErr.code });
      return { ok: false, message: "Guardamos la sesión, pero no los parciales. Probá nuevamente." };
    }
  }

  revalidatePath("/plan");
  revalidatePath("/hoy");
  revalidatePath("/progreso");
  revalidatePath("/inicio");
  return { ok: true, workoutId: saved.id };
}
