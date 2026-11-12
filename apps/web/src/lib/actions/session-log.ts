"use server";

import { planDayAt, plausibleSplit, sessionTimes, sessionTotals } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { getWeekDays } from "@/lib/data/library";
import { planPaces } from "@/lib/data/paces";
import { logError } from "@/lib/log";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Tiempo real (s) de cada fila de la sesión, en el mismo orden; null = como estaba prescripto. */
  actual: z.array(z.number().int().min(1).max(86400).nullable()).max(400),
  rpe: z.number().int().min(1).max(10),
  /** Frecuencia cardíaca media y máxima de la sesión (opcionales, en lpm). */
  avgHr: z.number().int().min(30).max(250).nullable().optional(),
  maxHr: z.number().int().min(30).max(250).nullable().optional(),
});
export type SessionLogInput = z.input<typeof schema>;
export type SessionLogResult = { ok: true; workoutId: string; meters: number; seconds: number } | { ok: false; message: string };

/**
 * Guardar la sesión desde el plan: con lo prescripto (según el test) y los parciales que la persona
 * corrigió, arma solo el registro del día (distancia, duración, RPE) y sus parciales. Lo prescripto se
 * vuelve a calcular acá con el contenido del plan: del navegador solo llegan los tiempos reales.
 */
export async function saveSessionLogAction(input: SessionLogInput): Promise<SessionLogResult> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisá los tiempos de la sesión." };
  const v = parsed.data;
  const today = todayIn(profile.timezone);
  if (v.date > today) return { ok: false, message: "Todavía no llegó ese día." };
  if (v.avgHr && v.maxHr && v.avgHr > v.maxHr) return { ok: false, message: "La FC media no puede ser mayor que la máxima." };

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: "No tenés un plan en curso." };
  const slot = planDayAt(open.enrollment, open.segments, open.plan.duration_weeks, v.date);
  const day = slot ? (await getWeekDays(supabase, open.enrollment.content_version, open.plan.id, slot.planWeek)).find((d) => d.day_index === slot.dayIndex) : null;
  if (!slot || !day || day.is_rest) return { ok: false, message: "Ese día no tiene entrenamiento en tu plan." };

  const { test } = await planPaces(supabase, user.id, open.library.version.model_runner_assumptions, open.plan.chapter, today);
  const times = sessionTimes(day, test);
  if (v.actual.length > times.rows.length) return { ok: false, message: "La sesión cambió: recargá la página." };
  for (const [i, s] of v.actual.entries()) {
    const row = times.rows[i]!;
    if (s === null) continue;
    if (!row.editable || !row.meters || !plausibleSplit(row.meters, s)) return { ok: false, message: `Revisá el tiempo de «${row.label}»: no parece correcto.` };
  }
  // Con todos los tiempos (reales o prescriptos) se calcula; si falta alguno (sin test), la estimación del plan.
  const totals = sessionTotals(times, v.actual) ?? {
    meters: Math.round((day.distance_km_est ?? 0) * 1000),
    seconds: Math.round((day.duration_min_est ?? 0) * 60),
  };
  if (!totals.seconds) return { ok: false, message: "Cargá los tiempos de la sesión." };

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id, status")
    .eq("enrollment_id", open.enrollment.id)
    .eq("workout_date", v.date)
    .maybeSingle<{ id: string; status: string }>();
  const fields = {
    status: existing?.status === "modified" ? "modified" : "completed",
    distance_m: totals.meters || null,
    duration_s: totals.seconds,
    rpe: v.rpe,
    avg_hr: v.avgHr ?? null,
    max_hr: v.maxHr ?? null,
  };
  const { data: saved, error } = existing
    ? await supabase.from("workout_logs").update(fields).eq("id", existing.id).select("id").single<{ id: string }>()
    : await supabase
        .from("workout_logs")
        .insert({ ...fields, user_id: user.id, enrollment_id: open.enrollment.id, plan_week: slot.planWeek, plan_day_index: slot.dayIndex, workout_date: v.date })
        .select("id")
        .single<{ id: string }>();
  if (error || !saved) {
    logError("session-log:save", { code: error?.code });
    return { ok: false, message: "No pudimos guardar la sesión. Probá nuevamente." };
  }

  // Parciales: cada tramo por distancia, con el tiempo real o el prescripto.
  const splits = times.rows
    .map((r, i) => ({ r, s: (r.editable ? (v.actual[i] ?? r.seconds) : null) as number | null }))
    .filter((x): x is { r: (typeof times.rows)[number]; s: number } => x.r.editable && x.r.meters !== null && x.s !== null)
    .map((x, n) => ({ workout_id: saved.id, user_id: user.id, split_index: n + 1, distance_m: x.r.meters!, duration_s: x.s }));
  const { error: delErr } = await supabase.from("workout_splits").delete().eq("workout_id", saved.id);
  if (delErr) logError("session-log:splits-delete", { code: delErr.code });
  if (splits.length) {
    const { error: sErr } = await supabase.from("workout_splits").insert(splits);
    if (sErr) {
      logError("session-log:splits", { code: sErr.code });
      return { ok: false, message: "Guardamos la sesión, pero no los parciales. Probá nuevamente." };
    }
  }

  revalidatePath("/plan");
  revalidatePath("/hoy");
  revalidatePath("/progreso");
  revalidatePath("/inicio");
  revalidatePath("/entrenamientos");
  return { ok: true, workoutId: saved.id, meters: totals.meters, seconds: totals.seconds };
}
