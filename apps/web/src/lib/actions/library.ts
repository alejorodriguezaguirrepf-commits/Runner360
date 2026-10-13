"use server";

import { assessPlan, earliestStart, recommendPlan, timingForRace, type AssessedPlan, type RaceTiming, type Recommendation } from "@runner360/plan-library";
import { formDataToObject, fieldErrors, todayIn } from "@runner360/shared";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { findPlan, getLibrary } from "@/lib/data/library";
import { assessmentInputSchema, toAssessment } from "@/lib/library/assessment-input";
import { t } from "@/i18n";

export interface AssistantState extends ActionState {
  result?: {
    recommendation: Recommendation;
    /** Evaluación del plan desde el que se llegó al asistente (si hay). */
    focus: (AssessedPlan & { timing: RaceTiming | null }) | null;
    /** Primer lunes posible para empezar. */
    earliestStart: string;
  };
}

/**
 * Evalúa la evaluación inicial contra los requisitos de ingreso. No guarda nada: las respuestas
 * (incluidas las de salud) solo se usan para calcular la recomendación.
 */
export async function assessAction(_prev: AssistantState, formData: FormData): Promise<AssistantState> {
  const { profile } = await requireOnboardedSession();
  const parsed = assessmentInputSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: t.library.assistant.errors };
  const library = await getLibrary();
  if (!library) return { ok: false, message: t.library.unavailable.title };

  const today = todayIn(profile.timezone);
  const input = parsed.data;
  if (!library.plans.some((p) => p.distance_km === input.distanceKm)) {
    return { ok: false, errors: { distanceKm: t.library.assistant.validation.distance }, message: t.library.assistant.errors };
  }
  if (input.markDate && input.markDate > today) {
    return { ok: false, errors: { markDate: t.library.assistant.validation.markFuture }, message: t.library.assistant.errors };
  }
  if (input.raceDate && input.raceDate < today) {
    return { ok: false, errors: { raceDate: t.library.assistant.validation.raceFuture }, message: t.library.assistant.errors };
  }

  const assessment = toAssessment(input);
  const lowVolumeAdaptation = library.version.individual_adaptation.find((x) => x.situation === "Volumen actual menor que el requisito")?.adaptation ?? null;
  const recommendation = recommendPlan({ plans: library.plans, distanceKm: input.distanceKm, assessment, today, lowVolumeAdaptation });

  const focusPlan = input.plan ? findPlan(library, input.plan) : null;
  const focus = focusPlan
    ? { ...assessPlan(focusPlan, assessment, { today }), timing: assessment.raceDate ? timingForRace(assessment.raceDate, focusPlan.race_week, today) : null }
    : null;
  return { ok: true, result: { recommendation, focus, earliestStart: earliestStart(today) } };
}
