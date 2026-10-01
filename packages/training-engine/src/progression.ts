import type { ProgressionRules } from "./model";

export interface WeekReview {
  plannedSessions: number;
  doneSessions: number;
  /** Pares de RPE reportado vs. RPE máximo planificado, por sesión registrada. */
  rpe: Array<{ reported: number | null; plannedMax: number | null }>;
}

export type ProgressionAdvice =
  | { kind: "continue"; message: string }
  | { kind: "repeat_week_suggested"; message: string }
  | { kind: "review_with_coach"; message: string }
  | { kind: "insufficient_data"; message: string };

/**
 * Aplica reglas de progresión configuradas en la versión del plan.
 * Devuelve SOLO una sugerencia: el plan asignado nunca se modifica automáticamente.
 */
export function evaluateWeek(review: WeekReview, rules: ProgressionRules): ProgressionAdvice {
  if (review.plannedSessions === 0) {
    return { kind: "insufficient_data", message: "No hay sesiones planificadas para evaluar." };
  }
  const overRpe = review.rpe.filter(
    (r) => r.reported != null && r.plannedMax != null && r.reported >= r.plannedMax + rules.rpeOverTargetMargin,
  ).length;
  if (overRpe >= rules.rpeOverTargetSessions) {
    return {
      kind: "review_with_coach",
      message:
        "Reportaste un esfuerzo bastante mayor al planificado en varias sesiones. Te sugerimos consultarlo con tu entrenador antes de seguir aumentando la carga.",
    };
  }
  const compliance = review.doneSessions / review.plannedSessions;
  if (compliance < rules.minWeeklyCompliance) {
    return {
      kind: "repeat_week_suggested",
      message: `Completaste ${review.doneSessions} de ${review.plannedSessions} sesiones. Podés considerar repetir la semana antes de avanzar.`,
    };
  }
  return { kind: "continue", message: "Buen trabajo: la semana cumple los criterios configurados para avanzar." };
}
