import { addDays, earliestStart } from "@runner360/plan-library";

/** Hasta cuántas semanas adelante se puede elegir el lunes de inicio de un plan. */
export const MAX_START_WEEKS_AHEAD = 12;

/** Lunes de inicio posibles: el próximo (u hoy si es lunes) y los siguientes. */
export function startMondays(today: string, weeks = MAX_START_WEEKS_AHEAD): string[] {
  const first = earliestStart(today);
  return Array.from({ length: weeks + 1 }, (_, i) => addDays(first, i * 7));
}
