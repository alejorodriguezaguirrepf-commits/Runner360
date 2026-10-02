import { ageOn } from "./dates";
import type { TrainingProfile } from "./schemas";

/**
 * Evaluación de seguridad previa a la asignación de un plan.
 * NO es un diagnóstico médico: solo decide si el sistema puede asignar un plan automáticamente
 * o si debe recomendar una fase introductoria o una revisión profesional.
 */

export type ReadinessStatus = "ok" | "introductory_phase" | "professional_review";

export type ReadinessReasonCode =
  | "HEALTH_FLAGS_DECLARED"
  | "UNDER_MIN_AGE"
  | "NO_RUNNING_BASE_FOR_DISTANCE"
  | "LEVEL_INCONSISTENT_WITH_EXPERIENCE";

export interface ReadinessResult {
  status: ReadinessStatus;
  reasons: ReadinessReasonCode[];
}

export interface ReadinessRules {
  /** Edad mínima para asignar un plan automáticamente sin acompañamiento profesional. */
  minAgeForAutomaticPlan: number;
  /** Km semanales por debajo de los cuales una distancia > 5K requiere fase introductoria. */
  minWeeklyKmForLongerDistances: number;
}

export const DEFAULT_READINESS_RULES: ReadinessRules = {
  minAgeForAutomaticPlan: 18,
  minWeeklyKmForLongerDistances: 5,
};

export function assessReadiness(
  profile: TrainingProfile,
  today: string,
  rules: ReadinessRules = DEFAULT_READINESS_RULES,
): ReadinessResult {
  const review: ReadinessReasonCode[] = [];
  const intro: ReadinessReasonCode[] = [];

  if (profile.healthFlags.length > 0) review.push("HEALTH_FLAGS_DECLARED");
  if (ageOn(profile.birthDate, today) < rules.minAgeForAutomaticPlan) review.push("UNDER_MIN_AGE");

  if (review.length > 0) return { status: "professional_review", reasons: review };

  if (profile.targetDistance !== "5K" && profile.weeklyKm < rules.minWeeklyKmForLongerDistances) {
    intro.push("NO_RUNNING_BASE_FOR_DISTANCE");
  }
  if (profile.level !== "beginner" && profile.experience === "none") {
    intro.push("LEVEL_INCONSISTENT_WITH_EXPERIENCE");
  }

  if (intro.length > 0) return { status: "introductory_phase", reasons: intro };
  return { status: "ok", reasons: [] };
}
