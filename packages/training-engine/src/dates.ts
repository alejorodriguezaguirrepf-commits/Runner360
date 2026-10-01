/**
 * Fechas calendario como cadenas "YYYY-MM-DD" (sin hora ni zona). Toda la aritmética se hace en UTC
 * para evitar corrimientos por horario de verano o zona horaria del dispositivo.
 */
export type DateKey = string;

const DAY_MS = 86_400_000;

export function toUtcDate(key: DateKey): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Fecha inválida: ${key}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function fromUtcDate(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromUtcDate(new Date(toUtcDate(key).getTime() + days * DAY_MS));
}

export function diffDays(from: DateKey, to: DateKey): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(key: DateKey): number {
  const d = toUtcDate(key).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lunes de la semana que contiene la fecha. */
export function startOfIsoWeek(key: DateKey): DateKey {
  return addDays(key, 1 - isoWeekday(key));
}

/** Próximo lunes (o la misma fecha si ya es lunes). */
export function nextMondayOnOrAfter(key: DateKey): DateKey {
  const wd = isoWeekday(key);
  return wd === 1 ? key : addDays(key, 8 - wd);
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

/** Convierte un instante ISO a fecha local en la zona indicada (por defecto Argentina). */
export function toLocalDateKey(
  instant: string | Date,
  timeZone = "America/Argentina/Buenos_Aires",
): DateKey {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new Error("Instante inválido");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
