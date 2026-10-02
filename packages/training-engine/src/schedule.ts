import { addDays, compareDates, diffDays, mondayOf, nextMondayOnOrAfter } from "./dates";
import type { PlanVersion, ScheduleVariant } from "./schemas";

/**
 * Distribución de sesiones en el calendario del usuario.
 * El motor NUNCA inventa sesiones: solo ubica las sesiones del plan publicado en días
 * concretos usando variantes de distribución definidas y aprobadas en el plan.
 */

export type VariantResolution =
  | { ok: true; variant: ScheduleVariant }
  | { ok: false; reason: "NO_VALIDATED_VARIANT"; sessionsPerWeek: number };

/**
 * Devuelve la variante de mayor prioridad (menor número) cuyos días estén todos incluidos
 * en los días disponibles del usuario.
 */
export function resolveScheduleVariant(
  version: Pick<PlanVersion, "scheduleVariants" | "sessionsPerWeek">,
  availableWeekdays: readonly number[],
): VariantResolution {
  const available = new Set(availableWeekdays);
  const candidates = version.scheduleVariants
    .filter((v) => v.weekdays.length === version.sessionsPerWeek)
    .filter((v) => v.weekdays.every((d) => available.has(d)))
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
  const first = candidates[0];
  if (!first) return { ok: false, reason: "NO_VALIDATED_VARIANT", sessionsPerWeek: version.sessionsPerWeek };
  return { ok: true, variant: first };
}

export type StartDateResult =
  | { ok: true; startDate: string; weeksUntilStart: number }
  | { ok: false; reason: "INSUFFICIENT_TIME"; weeksAvailable: number; weeksRequired: number }
  | { ok: false; reason: "RACE_DATE_IN_PAST" };

/**
 * Calcula el lunes de inicio del plan.
 *  - Sin competencia: el próximo lunes (o hoy si es lunes).
 *  - Con competencia: se alinea para que la última semana del plan sea la semana de la carrera.
 *    Si no hay tiempo suficiente, NO se comprime el plan: se informa para revisión profesional.
 */
export function computeStartDate(params: {
  today: string;
  durationWeeks: number;
  startWeek: number;
  raceDate: string | null;
}): StartDateResult {
  const { today, durationWeeks, startWeek, raceDate } = params;
  const earliest = nextMondayOnOrAfter(today);
  if (!raceDate) return { ok: true, startDate: earliest, weeksUntilStart: 0 };
  if (compareDates(raceDate, today) < 0) return { ok: false, reason: "RACE_DATE_IN_PAST" };

  const weeksRequired = durationWeeks - startWeek + 1;
  const raceMonday = mondayOf(raceDate);
  const startDate = addDays(raceMonday, -(weeksRequired - 1) * 7);
  if (compareDates(startDate, earliest) < 0) {
    const weeksAvailable = Math.max(0, Math.floor(diffDays(earliest, raceMonday) / 7) + 1);
    return { ok: false, reason: "INSUFFICIENT_TIME", weeksAvailable, weeksRequired };
  }
  return { ok: true, startDate, weeksUntilStart: diffDays(earliest, startDate) / 7 };
}

export interface CalendarEntry {
  weekNumber: number;
  sessionNumber: number;
  sessionId: string | undefined;
  scheduledDate: string;
}

/**
 * Genera el calendario individual desde `startWeek` hasta el final del plan.
 * `startDate` debe ser lunes (corresponde a la semana `startWeek`).
 */
export function generateCalendar(params: {
  version: Pick<PlanVersion, "durationWeeks" | "sessionsPerWeek" | "sessions">;
  variant: ScheduleVariant;
  startDate: string;
  startWeek: number;
}): CalendarEntry[] {
  const { version, variant, startDate, startWeek } = params;
  if (mondayOf(startDate) !== startDate) throw new RangeError("La fecha de inicio debe ser un lunes");
  if (startWeek < 1 || startWeek > version.durationWeeks) throw new RangeError("Semana inicial fuera de rango");
  if (variant.weekdays.length !== version.sessionsPerWeek) {
    throw new RangeError("La variante no coincide con las sesiones por semana del plan");
  }

  const entries: CalendarEntry[] = [];
  for (const session of version.sessions) {
    if (session.weekNumber < startWeek) continue;
    const weekday = variant.weekdays[session.sessionNumber - 1];
    if (weekday === undefined) throw new RangeError(`La sesión ${session.sessionNumber} no tiene día asignado`);
    const weekMonday = addDays(startDate, (session.weekNumber - startWeek) * 7);
    entries.push({
      weekNumber: session.weekNumber,
      sessionNumber: session.sessionNumber,
      sessionId: session.id,
      scheduledDate: addDays(weekMonday, weekday - 1),
    });
  }
  return entries.sort(
    (a, b) => compareDates(a.scheduledDate, b.scheduledDate) || a.sessionNumber - b.sessionNumber,
  );
}

/** Semana del plan en curso para una fecha dada, o `null` si está fuera del calendario. */
export function currentPlanWeek(params: {
  startDate: string;
  startWeek: number;
  durationWeeks: number;
  today: string;
}): number | null {
  const offset = Math.floor(diffDays(params.startDate, params.today) / 7);
  if (offset < 0) return null;
  const week = params.startWeek + offset;
  return week > params.durationWeeks ? null : week;
}
