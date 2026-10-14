"use server";

import {
  addDays,
  allowedDecisions,
  evaluateLog,
  mondayOf,
  nextPlanWeek,
  planDayAt,
  ruleText,
  type LoadDecision,
  type RedFlag,
} from "@runner360/plan-library";
import { fieldErrors, formDataToObject, todayIn } from "@runner360/shared";
import { parseDuration } from "@runner360/training-engine";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { getWeekDays } from "@/lib/data/library";
import { loadWeek, resumeTarget, weekEvaluation } from "@/lib/library/week";
import { logError } from "@/lib/log";

const L = t.library.log;
const C = t.library.checkin;
const RED_FLAGS = ["limp", "bone_pain", "swelling", "night_pain"] as const;

const empty = (x: unknown) => (x === "" || x === undefined || x === null ? null : x);
const intRange = (min: number, max: number) => z.preprocess(empty, z.coerce.number().int().min(min).max(max).nullable());

const logSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["completed", "modified", "skipped"]),
  duration: z.preprocess(
    empty,
    z
      .string()
      .transform((s, ctx) => {
        const n = parseDuration(s.trim());
        if (n === null || n <= 0 || n > 172800) {
          ctx.addIssue({ code: "custom", message: t.library.form.time });
          return z.NEVER;
        }
        return n;
      })
      .nullable(),
  ),
  distanceKm: z.preprocess((x) => (typeof x === "string" ? (x.trim() === "" ? null : x.replace(",", ".")) : x), z.coerce.number().min(0).max(400).nullable()),
  rpe: intRange(1, 10),
  pain: intRange(0, 10),
  redFlags: z.array(z.enum(RED_FLAGS)).max(4),
  sleep: z.preprocess(empty, z.enum(["good", "fair", "poor"]).nullable()),
  notes: z.preprocess(empty, z.string().trim().max(2000).nullable()),
  healthConsent: z.preprocess((x) => x === "on" || x === "true", z.boolean()),
});

export interface LogState extends ActionState {
  /** Textos del contenido que corresponden a lo registrado (p. ej. dolor). */
  ruleTexts?: string[];
}

/**
 * Registro post-sesión. Dolor, señales de alarma y sueño son datos de salud: requieren consentimiento
 * expreso y nunca se escriben en los logs. Dolor > 5 o una señal de alarma pausan el plan.
 */
export async function logPlanSessionAction(_prev: LogState, formData: FormData): Promise<LogState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const raw = formDataToObject(formData, ["redFlags"]);
  const parsed = logSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: L.errors };
  const v = parsed.data;
  const today = todayIn(profile.timezone);
  if (v.date > today) return { ok: false, message: L.future };
  if (v.status !== "skipped" && v.duration === null) return { ok: false, errors: { duration: L.durationRequired }, message: L.errors };

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: L.generic };
  const slot = planDayAt(open.enrollment, open.segments, open.plan.duration_weeks, v.date);
  const day = slot ? (await getWeekDays(supabase, open.enrollment.content_version, open.plan.id, slot.planWeek)).find((d) => d.day_index === slot.dayIndex) : null;
  if (!slot || !day || day.is_rest) return { ok: false, message: L.notSessionDay };

  const health = v.pain !== null || v.redFlags.length > 0 || v.sleep !== null;
  if (health) {
    const { data: consent } = await supabase.rpc("has_consent", { p_user: user.id, p_type: "health_data" });
    if (consent !== true) {
      if (!v.healthConsent) return { ok: false, errors: { healthConsent: L.consentRequired }, message: L.consentRequired };
      const { error } = await supabase
        .from("user_consents")
        .insert({ user_id: user.id, consent_type: "health_data", document_version: LEGAL_VERSIONS.health_data, granted: true });
      if (error) {
        logError("log:consent", error);
        return { ok: false, message: L.generic };
      }
    }
  }

  const row = {
    user_id: user.id,
    enrollment_id: open.enrollment.id,
    plan_week: slot.planWeek,
    plan_day_index: slot.dayIndex,
    workout_date: v.date,
    status: v.status,
    duration_s: v.status === "skipped" ? null : v.duration,
    distance_m: v.status === "skipped" || v.distanceKm === null ? null : Math.round(v.distanceKm * 1000),
    rpe: v.status === "skipped" ? null : v.rpe,
    pain_score: v.pain,
    pain_reported: (v.pain ?? 0) > 0 || v.redFlags.length > 0,
    red_flags: v.redFlags as RedFlag[],
    sleep_quality: v.sleep,
    comments: v.notes,
  };
  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("enrollment_id", open.enrollment.id)
    .eq("workout_date", v.date)
    .maybeSingle<{ id: string }>();
  const { error } = existing ? await supabase.from("workout_logs").update(row).eq("id", existing.id) : await supabase.from("workout_logs").insert(row);
  if (error) {
    // Sin detalles del registro: puede contener datos de salud.
    logError("log:save", { code: error.code });
    return { ok: false, message: L.generic };
  }

  const hits = evaluateLog({
    date: v.date,
    planDayIndex: slot.dayIndex,
    status: v.status,
    rpe: v.rpe,
    pain: v.pain,
    redFlags: v.redFlags as RedFlag[],
    sleep: v.sleep,
    category: day.category,
  });
  const ruleTexts = hits.map((h) => ruleText(h.source, open.library.version)).filter((x): x is string => Boolean(x));
  let paused = false;
  if (hits.some((h) => h.recommendation === "pause") && open.enrollment.status === "active") {
    // "Suspender y consultar": la semana se pausa.
    const weekStart = mondayOf(v.date);
    await supabase.from("weekly_checkins").insert(
      {
        enrollment_id: open.enrollment.id,
        user_id: user.id,
        week_start: weekStart,
        plan_week: slot.planWeek,
        criterion_met: null,
        recommendation: "pause",
        rule_ids: hits.map((h) => h.id),
        decision: "pause",
        next_week_start: null,
        next_plan_week: null,
      },
    );
    await supabase.from("plan_enrollments").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", open.enrollment.id);
    paused = true;
  }
  revalidatePath("/hoy");
  revalidatePath("/plan");
  revalidatePath("/inicio");
  // Con la pausa, la pantalla de Hoy pasa a la vista de pausa: el aviso se muestra ahí.
  if (paused) redirect("/hoy?pausa=1");
  return { ok: true, message: L.saved, ruleTexts };
}

const checkinSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnTo: z.enum(["/hoy", "/plan"]).default("/hoy"),
  criterion: z.enum(["yes", "no"]),
  decision: z.enum(["advance", "repeat", "reduce", "regress", "pause"]),
});

/** Check-in semanal: el motor recomienda (se recalcula acá) y la persona confirma una decisión permitida. */
export async function checkinAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = checkinSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: C.generic };
  const { weekStart, criterion, decision, returnTo } = parsed.data;
  const today = todayIn(profile.timezone);
  const open = await getOpenEnrollment(supabase, user.id);
  if (!open || open.enrollment.status !== "active" || weekStart > mondayOf(today)) return { ok: false, message: C.generic };
  const data = await loadWeek(supabase, open, weekStart);
  if (!data) return { ok: false, message: C.generic };

  const { evaluation } = await weekEvaluation(supabase, open, data, today, criterion === "yes");
  if (!allowedDecisions(evaluation.recommendation).includes(decision as LoadDecision)) return { ok: false, message: C.notAllowed };

  const finished = decision === "advance" && data.planWeek >= open.plan.duration_weeks;
  const { error } = await supabase.from("weekly_checkins").insert({
    enrollment_id: open.enrollment.id,
    user_id: user.id,
    week_start: weekStart,
    plan_week: data.planWeek,
    criterion_met: criterion === "yes",
    recommendation: evaluation.recommendation,
    rule_ids: evaluation.hits.map((h) => h.id),
    decision,
    next_week_start: decision === "pause" ? null : addDays(weekStart, 7),
    next_plan_week: decision === "pause" ? null : Math.min(open.plan.duration_weeks, nextPlanWeek(decision, data.planWeek, evaluation.regressTo)),
  });
  if (error) {
    logError("checkin:insert", { code: error.code });
    return { ok: false, message: C.generic };
  }
  if (decision === "pause") await supabase.from("plan_enrollments").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", open.enrollment.id);
  if (finished) await supabase.from("plan_enrollments").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", open.enrollment.id);
  revalidatePath("/hoy");
  revalidatePath("/plan");
  revalidatePath("/inicio");
  // La tarjeta desaparece al guardar (ya no hay check-in pendiente): la confirmación va en la página.
  redirect(`${returnTo}?checkin=${finished ? "fin" : "ok"}`);
}

/** Retomar después de una pausa: vuelve a la semana que indican las reglas prácticas según el tiempo sin entrenar. */
export async function resumePlanAction(): Promise<void> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const today = todayIn(profile.timezone);
  const open = await getOpenEnrollment(supabase, user.id);
  if (!open || open.enrollment.status !== "paused") return;
  const target = await resumeTarget(supabase, open, today);
  // Se retoma desde el lunes de esta semana (también si la pausa fue en esta misma semana).
  const weekStart = mondayOf(today);
  const { error } = await supabase.from("weekly_checkins").insert({
    enrollment_id: open.enrollment.id,
    user_id: user.id,
    week_start: weekStart,
    plan_week: target,
    criterion_met: null,
    recommendation: "regress",
    rule_ids: [],
    decision: "resume",
    next_week_start: weekStart,
    next_plan_week: target,
  });
  if (error) logError("resume:insert", { code: error.code });
  else await supabase.from("plan_enrollments").update({ status: "active", paused_at: null }).eq("id", open.enrollment.id);
  revalidatePath("/hoy");
  revalidatePath("/plan");
  revalidatePath("/inicio");
}
