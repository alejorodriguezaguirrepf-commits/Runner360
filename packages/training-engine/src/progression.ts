import type { ProgressionRules } from "./schemas";

/**
 * Reglas de progresión configurables por versión de plan.
 * El resultado es una RECOMENDACIÓN: el motor nunca modifica el plan por sí solo.
 */

export interface WeekOutcome {
  planned: number;
  /** Completadas + modificadas. */
  done: number;
  /** RPE medio de los registros de la semana, si existen. */
  avgRpe: number | null;
  painReported: boolean;
}

export type ProgressionAction = "advance" | "advance_with_caution" | "repeat_week" | "professional_review";

export type ProgressionReason =
  | "COMPLIANCE_OK"
  | "COMPLIANCE_LOW"
  | "COMPLIANCE_VERY_LOW"
  | "HIGH_PERCEIVED_EFFORT"
  | "PAIN_REPORTED"
  | "NO_PLANNED_SESSIONS";

export interface ProgressionDecision {
  action: ProgressionAction;
  compliance: number | null;
  reasons: ProgressionReason[];
}

export function evaluateProgression(rules: ProgressionRules, week: WeekOutcome): ProgressionDecision {
  if (rules.reviewOnPainReport && week.painReported) {
    return { action: "professional_review", compliance: ratio(week), reasons: ["PAIN_REPORTED"] };
  }
  if (week.avgRpe !== null && week.avgRpe > rules.reviewAboveAvgRpe) {
    return { action: "professional_review", compliance: ratio(week), reasons: ["HIGH_PERCEIVED_EFFORT"] };
  }
  const c = ratio(week);
  if (c === null) return { action: "advance", compliance: null, reasons: ["NO_PLANNED_SESSIONS"] };
  if (c < rules.repeatWeekBelowCompliance) return { action: "repeat_week", compliance: c, reasons: ["COMPLIANCE_VERY_LOW"] };
  if (c < rules.minComplianceToAdvance) {
    return { action: "advance_with_caution", compliance: c, reasons: ["COMPLIANCE_LOW"] };
  }
  return { action: "advance", compliance: c, reasons: ["COMPLIANCE_OK"] };
}

function ratio(week: WeekOutcome): number | null {
  if (week.planned <= 0) return null;
  return Math.min(1, Math.max(0, week.done / week.planned));
}
