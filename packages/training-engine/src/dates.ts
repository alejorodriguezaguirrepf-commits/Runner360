/**
 * Aritmética de fechas de calendario en UTC puro, para evitar errores por zona horaria
 * o cambios de horario. Todas las fechas son strings `YYYY-MM-DD`.
 */

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) throw new RangeError(`Fecha inválida: ${date}`);
  return t;
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Día ISO de la semana: 1 = lunes ... 7 = domingo. */
export function isoWeekday(date: string): number {
  const d = new Date(toUtc(date)).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lunes de la semana que contiene `date`. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** `date` si es lunes; si no, el lunes siguiente. */
export function nextMondayOnOrAfter(date: string): string {
  const wd = isoWeekday(date);
  return wd === 1 ? date : addDays(date, 8 - wd);
}

/** Diferencia entera en días (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Edad en años cumplidos a la fecha `on`. */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Mes calendario `YYYY-MM` de una fecha. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}
