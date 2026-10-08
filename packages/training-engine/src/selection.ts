import { ageOn } from "./dates";
import { assessReadiness, type ReadinessResult, type ReadinessRules, DEFAULT_READINESS_RULES } from "./readiness";
import { computeStartDate, generateCalendar, resolveScheduleVariant, type CalendarEntry } from "./schedule";
import { EXPERIENCE_MIN_MONTHS, type PlanVersion, type ScheduleVariant, type TrainingProfile } from "./schemas";

/**
 * Selección y asignación de un plan a un corredor. Función pura y determinista:
 * dado el mismo perfil, catálogo y fecha, siempre devuelve el mismo resultado.
 */

export type UnmetRequirement = "MIN_WEEKLY_KM" | "MIN_EXPERIENCE" | "MIN_AGE";

export type AssignmentResult =
  | {
      kind: "assigned";
      version: PlanVersion;
      variant: ScheduleVariant;
      startWeek: number;
      startDate: string;
      calendar: CalendarEntry[];
      readiness: ReadinessResult;
    }
  | { kind: "readiness_blocked"; readiness: ReadinessResult }
  | { kind: "no_published_plan" }
  | { kind: "requirements_not_met"; version: PlanVersion; unmet: UnmetRequirement[] }
  | { kind: "needs_professional_configuration"; version: PlanVersion; sessionsPerWeek: number }
  | { kind: "insufficient_time"; version: PlanVersion; weeksAvailable: number; weeksRequired: number }
  | { kind: "race_date_in_past" };

export function unmetRequirements(
  version: Pick<PlanVersion, "entryRequirements">,
  profile: TrainingProfile,
  today: string,
): UnmetRequirement[] {
  const req = version.entryRequirements;
  const unmet: UnmetRequirement[] = [];
  if (profile.weeklyKm < req.minWeeklyKm) unmet.push("MIN_WEEKLY_KM");
  if (EXPERIENCE_MIN_MONTHS[profile.experience] < req.minExperienceMonths) unmet.push("MIN_EXPERIENCE");
  if (ageOn(profile.birthDate, today) < req.minAge) unmet.push("MIN_AGE");
  return unmet;
}

/** Semana inicial según las reglas del plan: la regla aplicable con mayor semana de inicio. */
export function determineStartWeek(version: Pick<PlanVersion, "startWeekRules" | "durationWeeks">, weeklyKm: number): number {
  let start = 1;
  for (const rule of version.startWeekRules) {
    if (weeklyKm >= rule.minWeeklyKm && rule.startWeek > start) start = rule.startWeek;
  }
  return Math.min(start, version.durationWeeks);
}

/**
 * Elige la versión publicada adecuada: misma distancia y nivel; prioriza versiones validadas
 * (no DEMO) y, entre ellas, el número de versión más alto.
 */
export function pickPublishedVersion(
  catalog: readonly PlanVersion[],
  profile: Pick<TrainingProfile, "targetDistance" | "level">,
): PlanVersion | null {
  const matches = catalog
    .filter((v) => v.status === "published")
    .filter((v) => v.distance === profile.targetDistance && v.level === profile.level)
    .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || b.versionNumber - a.versionNumber);
  return matches[0] ?? null;
}

export function assignPlan(params: {
  profile: TrainingProfile;
  catalog: readonly PlanVersion[];
  today: string;
  readinessRules?: ReadinessRules;
  /** Permite forzar una versión concreta (p. ej. elegida por el usuario en el catálogo). */
  versionId?: string;
}): AssignmentResult {
  const { profile, catalog, today } = params;
  const readiness = assessReadiness(profile, today, params.readinessRules ?? DEFAULT_READINESS_RULES);
  if (readiness.status !== "ok") return { kind: "readiness_blocked", readiness };

  const version = params.versionId
    ? (catalog.find((v) => v.id === params.versionId && v.status === "published") ?? null)
    : pickPublishedVersion(catalog, profile);
  if (!version) return { kind: "no_published_plan" };

  const unmet = unmetRequirements(version, profile, today);
  if (unmet.length > 0) return { kind: "requirements_not_met", version, unmet };

  const variantResult = resolveScheduleVariant(version, profile.availableWeekdays);
  if (!variantResult.ok) {
    return { kind: "needs_professional_configuration", version, sessionsPerWeek: variantResult.sessionsPerWeek };
  }

  const startWeek = determineStartWeek(version, profile.weeklyKm);
  const start = computeStartDate({
    today,
    durationWeeks: version.durationWeeks,
    startWeek,
    raceDate: profile.raceDate,
  });
  if (!start.ok) {
    if (start.reason === "RACE_DATE_IN_PAST") return { kind: "race_date_in_past" };
    return {
      kind: "insufficient_time",
      version,
      weeksAvailable: start.weeksAvailable,
      weeksRequired: start.weeksRequired,
    };
  }

  const calendar = generateCalendar({ version, variant: variantResult.variant, startDate: start.startDate, startWeek });
  return {
    kind: "assigned",
    version,
    variant: variantResult.variant,
    startWeek,
    startDate: start.startDate,
    calendar,
    readiness,
  };
}
