import type { RaceDistance, RunnerLevel } from "@runner360/shared";
import { addDays, diffDays, nextMondayOnOrAfter, startOfIsoWeek, type DateKey } from "./dates";
import type { PlanVersion, ScheduleVariant } from "./model";

/** Datos del corredor relevantes para la asignación (subconjunto de training_profiles). */
export interface RunnerProfile {
  targetDistance: RaceDistance;
  level: RunnerLevel;
  experienceMonths: number;
  weeklyDistanceM: number;
  availableDays: number[];
  raceDate: DateKey | null;
  hasRecentInjury: boolean;
  hasMedicalCondition: boolean;
}

export interface Entitlements {
  premiumPlans: boolean;
}

export interface ScheduleMatch {
  variantId: string;
  weekdayPattern: number[];
}

export type PlanSelection =
  | {
      kind: "plan";
      version: PlanVersion;
      schedule: ScheduleMatch;
      startDate: DateKey;
      startWeek: number;
      notes: string[];
    }
  | { kind: "introductory_recommended"; reasons: string[]; version: PlanVersion | null; schedule: ScheduleMatch | null }
  | { kind: "professional_review_required"; reasons: string[] }
  | { kind: "needs_schedule_configuration"; version: PlanVersion; reasons: string[] }
  | { kind: "insufficient_time"; version: PlanVersion; weeksAvailable: number; reasons: string[] }
  | { kind: "premium_required"; version: PlanVersion }
  | { kind: "no_plan_available"; reasons: string[] };

/**
 * Busca el primer patrón validado de una variante cuyos días estén todos dentro de la disponibilidad del usuario.
 * No genera patrones nuevos: si no hay coincidencia, devuelve null y se requiere configuración profesional.
 */
export function matchSchedule(
  variants: ScheduleVariant[],
  availableDays: number[],
): ScheduleMatch | null {
  const available = new Set(availableDays);
  for (const v of variants) {
    for (const pattern of v.weekdayPatterns) {
      if (pattern.every((d) => available.has(d))) {
        return { variantId: v.id, weekdayPattern: [...pattern] };
      }
    }
  }
  return null;
}

export function meetsEntryRequirements(
  profile: RunnerProfile,
  version: PlanVersion,
): { ok: boolean; reasons: string[] } {
  const r = version.entryRequirements;
  const reasons: string[] = [];
  if (profile.weeklyDistanceM < r.minWeeklyDistanceM) {
    reasons.push(
      `El plan requiere una base de al menos ${(r.minWeeklyDistanceM / 1000).toLocaleString("es-AR")} km semanales`,
    );
  }
  if (profile.experienceMonths < r.minExperienceMonths) {
    reasons.push(`El plan requiere al menos ${r.minExperienceMonths} meses de experiencia corriendo`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Calcula fecha y semana de inicio.
 * - Sin competencia: comienza el próximo lunes, semana 1.
 * - Con competencia: alinea la última semana del plan con la semana de la carrera. Si faltan semanas,
 *   solo se permite omitir las iniciales hasta `maxSkippableWeeks`.
 */
export function computeStart(
  version: PlanVersion,
  today: DateKey,
  raceDate: DateKey | null,
):
  | { ok: true; startDate: DateKey; startWeek: number; notes: string[] }
  | { ok: false; weeksAvailable: number } {
  const firstMonday = nextMondayOnOrAfter(today);
  if (!raceDate) return { ok: true, startDate: firstMonday, startWeek: 1, notes: [] };

  const raceWeek = startOfIsoWeek(raceDate);
  const weeksAvailable = Math.floor(diffDays(firstMonday, raceWeek) / 7) + 1;
  if (weeksAvailable >= version.durationWeeks) {
    const startDate = addDays(raceWeek, -7 * (version.durationWeeks - 1));
    const notes =
      startDate !== firstMonday
        ? [`El plan comienza el ${startDate} para terminar la semana de tu competencia.`]
        : [];
    return { ok: true, startDate, startWeek: 1, notes };
  }
  const skip = version.durationWeeks - weeksAvailable;
  if (weeksAvailable >= 1 && skip <= version.progressionRules.maxSkippableWeeks) {
    return {
      ok: true,
      startDate: firstMonday,
      startWeek: skip + 1,
      notes: [`Por la fecha de tu competencia comenzás en la semana ${skip + 1}.`],
    };
  }
  return { ok: false, weeksAvailable: Math.max(0, weeksAvailable) };
}

/**
 * Selección determinista de plan a partir del perfil y del catálogo publicado.
 * Prioriza la seguridad: antecedentes de salud → revisión profesional; base insuficiente → fase introductoria.
 */
export function selectPlan(
  profile: RunnerProfile,
  catalog: PlanVersion[],
  today: DateKey,
  entitlements: Entitlements,
): PlanSelection {
  const published = catalog.filter((v) => v.status === "published");
  const introductory =
    published.find((v) => v.kind === "introductory" && (!v.requiresPremium || entitlements.premiumPlans)) ??
    null;

  const healthFlag = profile.hasRecentInjury || profile.hasMedicalCondition;
  const candidates = published.filter(
    (v) => v.kind === "standard" && v.targetDistance === profile.targetDistance && v.level === profile.level,
  );

  if (healthFlag && (candidates.length === 0 || candidates.some((c) => c.entryRequirements.requiresHealthClearance))) {
    return {
      kind: "professional_review_required",
      reasons: [
        "Indicaste una lesión reciente o una condición médica. Antes de comenzar un plan específico, consultá con un profesional de la salud y con un entrenador.",
      ],
    };
  }

  if (candidates.length === 0) {
    return { kind: "no_plan_available", reasons: ["Todavía no hay un plan publicado para tu distancia y nivel."] };
  }

  // Preferir la versión más reciente publicada.
  const version = [...candidates].sort((a, b) => b.version - a.version)[0]!;

  const entry = meetsEntryRequirements(profile, version);
  if (!entry.ok) {
    return {
      kind: "introductory_recommended",
      reasons: entry.reasons,
      version: introductory,
      schedule: introductory ? matchSchedule(introductory.scheduleVariants, profile.availableDays) : null,
    };
  }

  if (version.requiresPremium && !entitlements.premiumPlans) {
    return { kind: "premium_required", version };
  }

  const schedule = matchSchedule(version.scheduleVariants, profile.availableDays);
  if (!schedule) {
    return {
      kind: "needs_schedule_configuration",
      version,
      reasons: [
        `El plan necesita ${version.sessionsPerWeek} días por semana en una combinación validada. Con tus días disponibles se requiere una configuración profesional.`,
      ],
    };
  }

  const start = computeStart(version, today, profile.raceDate);
  if (!start.ok) {
    return {
      kind: "insufficient_time",
      version,
      weeksAvailable: start.weeksAvailable,
      reasons: [
        `El plan dura ${version.durationWeeks} semanas y hasta tu competencia quedan ${start.weeksAvailable}.`,
      ],
    };
  }

  return {
    kind: "plan",
    version,
    schedule,
    startDate: start.startDate,
    startWeek: start.startWeek,
    notes: start.notes,
  };
}
