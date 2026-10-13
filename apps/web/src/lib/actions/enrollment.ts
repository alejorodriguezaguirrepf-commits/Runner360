"use server";

import {
  assessPlan,
  earliestStart,
  isPermutation,
  raceDateFromStart,
  timingForRace,
  weekdayOf,
  type DayMapViolation,
} from "@runner360/plan-library";
import { formatDate, formDataToObject, fieldErrors, todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fmt, t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { findPlan, getLibrary } from "@/lib/data/library";
import { assessmentInputSchema, toAssessment } from "@/lib/library/assessment-input";
import { logError } from "@/lib/log";

const e = t.library.enroll.errors;

const enrollExtras = z.object({
  plan: z.string().regex(/^plan-\d{2}$/),
  startDate: z.preprocess((x) => (x === "" || x === undefined ? null : x), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

/**
 * Inscripción a un plan de la biblioteca. Vuelve a evaluar los requisitos EN EL SERVIDOR con las
 * respuestas de la evaluación inicial: si no se cumplen, no se puede empezar el plan.
 * Las respuestas de salud no se guardan; solo la marca reciente (para los ritmos de referencia).
 */
export async function enrollLibraryPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const raw = formDataToObject(formData);
  const parsed = assessmentInputSchema.safeParse(raw);
  const extras = enrollExtras.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: t.library.assistant.errors };
  if (!extras.success) return { ok: false, message: e.generic };

  const library = await getLibrary();
  const plan = library ? findPlan(library, extras.data.plan) : null;
  if (!library || !plan) return { ok: false, message: e.generic };

  const today = todayIn(profile.timezone);
  const assessment = toAssessment(parsed.data);
  if (!assessPlan(plan, assessment, { today }).eligible) return { ok: false, message: e.notEligible };

  let startDate: string;
  let raceDate: string;
  if (assessment.raceDate) {
    const timing = timingForRace(assessment.raceDate, plan.race_week, today);
    if (!timing.ok) {
      return { ok: false, message: timing.reason === "not_sunday" ? e.notSunday : fmt(e.timing, { date: formatDate(timing.earliestRaceDate, "long") }) };
    }
    ({ startDate, raceDate } = timing);
  } else {
    startDate = extras.data.startDate ?? earliestStart(today);
    if (weekdayOf(startDate) !== 0) return { ok: false, errors: { startDate: e.notMonday }, message: e.notMonday };
    if (startDate < earliestStart(today)) {
      const msg = fmt(e.tooEarly, { date: formatDate(earliestStart(today), "long") });
      return { ok: false, errors: { startDate: msg }, message: msg };
    }
    raceDate = raceDateFromStart(startDate, plan.race_week);
  }

  if (await getOpenEnrollment(supabase, user.id)) return { ok: false, message: e.alreadyEnrolled };

  const mark = assessment.recentMark;
  const { error } = await supabase.from("plan_enrollments").insert({
    user_id: user.id,
    content_version: plan.content_version,
    plan_id: plan.id,
    start_date: startDate,
    race_date: raceDate,
    mark_distance_m: mark ? Math.round(mark.distanceKm * 1000) : null,
    mark_time_s: mark ? Math.round(mark.timeS) : null,
    mark_date: mark?.date ?? null,
  });
  if (error) {
    logError("enrollment:insert", error);
    return { ok: false, message: error.code === "23505" ? e.alreadyEnrolled : e.generic };
  }
  // Un plan DEMO activo (sistema anterior) se cierra: no puede haber dos planes en curso.
  await supabase.from("user_training_plans").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "active");

  revalidatePath("/", "layout");
  redirect("/plan?inscripto=1");
}

const dayMapSchema = z.object(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`d${i}`, z.coerce.number().int().min(0).max(6)])));

export interface MoveDaysState extends ActionState {
  violations?: DayMapViolation[];
}

/** Mover días: se valida en el servidor (y otra vez en la base) la regla de días exigentes. */
export async function moveDaysAction(_prev: MoveDaysState, formData: FormData): Promise<MoveDaysState> {
  const { supabase, user } = await requireOnboardedSession();
  const parsed = dayMapSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, violations: ["not_permutation"] };
  const map = Array.from({ length: 7 }, (_, i) => parsed.data[`d${i}`] as number);
  if (!isPermutation(map)) return { ok: false, violations: ["not_permutation"] };

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: e.generic };
  // Todas las semanas del plan (aunque la persona no tenga acceso al detalle de todas).
  const { data: violations, error: rpcError } = await supabase.rpc("library_day_map_violations", {
    p_version: open.enrollment.content_version,
    p_plan: open.enrollment.plan_id,
    p_map: map,
  });
  if (rpcError) {
    logError("enrollment:violations", rpcError);
    return { ok: false, message: e.generic };
  }
  if (Array.isArray(violations) && violations.length > 0) return { ok: false, violations: violations as DayMapViolation[] };

  const { error } = await supabase.from("plan_enrollments").update({ day_map: map }).eq("id", open.enrollment.id);
  if (error) {
    logError("enrollment:move", error);
    return { ok: false, message: e.generic };
  }
  revalidatePath("/plan");
  return { ok: true, message: t.library.moveDays.saved };
}

export async function cancelEnrollmentAction(): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  await supabase
    .from("plan_enrollments")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["active", "paused"]);
  revalidatePath("/", "layout");
  redirect("/plan");
}
