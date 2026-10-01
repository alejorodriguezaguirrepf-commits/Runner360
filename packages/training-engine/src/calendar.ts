import { addDays, isoWeekday, type DateKey } from "./dates";
import type { PlanVersion } from "./model";

export interface CalendarEntry {
  /** id de training_sessions cuando la versión proviene de la base de datos. */
  sessionId: string | null;
  weekNumber: number;
  sessionNumber: number;
  scheduledDate: DateKey;
}

/**
 * Genera el calendario individual. La semana `startWeek` del plan empieza en `startDate` (un lunes);
 * cada sesión se ubica en el día del patrón correspondiente a su `daySlot`.
 * No crea sesiones: solo ubica en fechas las sesiones existentes de la versión.
 */
export function generateCalendar(params: {
  version: PlanVersion;
  startDate: DateKey;
  startWeek: number;
  weekdayPattern: number[];
}): CalendarEntry[] {
  const { version, startDate, startWeek, weekdayPattern } = params;
  if (isoWeekday(startDate) !== 1) throw new Error("La fecha de inicio debe ser un lunes");
  if (startWeek < 1 || startWeek > version.durationWeeks) throw new Error("Semana de inicio fuera de rango");
  if (weekdayPattern.length !== version.sessionsPerWeek)
    throw new Error("El patrón de días no coincide con las sesiones semanales del plan");

  const entries: CalendarEntry[] = [];
  const weeks = [...version.weeks]
    .filter((w) => w.weekNumber >= startWeek)
    .sort((a, b) => a.weekNumber - b.weekNumber);

  for (const week of weeks) {
    const weekStart = addDays(startDate, 7 * (week.weekNumber - startWeek));
    const sessions = [...week.sessions].sort((a, b) => a.daySlot - b.daySlot);
    for (const s of sessions) {
      const weekday = weekdayPattern[s.daySlot - 1];
      if (weekday == null) throw new Error(`Sin día asignado para el slot ${s.daySlot}`);
      entries.push({
        sessionId: s.id ?? null,
        weekNumber: week.weekNumber,
        sessionNumber: s.sessionNumber,
        scheduledDate: addDays(weekStart, weekday - 1),
      });
    }
  }
  return entries;
}

/** Semana del plan correspondiente a una fecha (null si está fuera del plan). */
export function planWeekForDate(params: {
  startDate: DateKey;
  startWeek: number;
  durationWeeks: number;
  date: DateKey;
}): number | null {
  const { startDate, startWeek, durationWeeks, date } = params;
  const days = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return null;
  const week = startWeek + Math.floor(days / 7);
  return week > durationWeeks ? null : week;
}
