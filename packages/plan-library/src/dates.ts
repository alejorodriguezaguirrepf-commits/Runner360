/**
 * Fechas de calendario como "YYYY-MM-DD" (sin hora ni zona: la zona del usuario se aplica antes,
 * al calcular "hoy"). Día de la semana: 0 = lunes … 6 = domingo, igual que day_index del contenido.
 */
const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Fecha inválida: ${date}`);
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`Fecha inválida: ${date}`);
  return t;
}

const fromUtc = (t: number) => new Date(t).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = lunes … 6 = domingo. */
export function weekdayOf(date: string): number {
  return (new Date(toUtc(date)).getUTCDay() + 6) % 7;
}

export function mondayOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/** Los planes empiezan un lunes: hoy si es lunes, si no el lunes siguiente. */
export function earliestStart(today: string): string {
  return weekdayOf(today) === 0 ? today : addDays(mondayOf(today), 7);
}

/** Domingo de la semana de competencia, a partir del lunes de inicio. */
export function raceDateFromStart(startMonday: string, raceWeek: number): string {
  if (weekdayOf(startMonday) !== 0) throw new Error("El plan empieza un lunes");
  return addDays(startMonday, (raceWeek - 1) * 7 + 6);
}

/** Lunes de inicio para que la competencia caiga el domingo de la semana de competencia. */
export function startFromRaceDate(raceSunday: string, raceWeek: number): string {
  if (weekdayOf(raceSunday) !== 6) throw new Error("La competencia del plan cae en domingo");
  return addDays(raceSunday, -((raceWeek - 1) * 7 + 6));
}

export type RaceTiming =
  | { ok: true; startDate: string; raceDate: string }
  | { ok: false; reason: "not_sunday" | "too_soon" | "in_past"; earliestRaceDate: string };

/**
 * ¿Alcanza el tiempo hasta la carrera? Si no, devuelve la primera fecha de competencia posible
 * con este plan (para sugerir una carrera posterior o un plan más corto).
 */
export function timingForRace(raceDate: string, raceWeek: number, today: string): RaceTiming {
  const earliestRaceDate = raceDateFromStart(earliestStart(today), raceWeek);
  if (raceDate < today) return { ok: false, reason: "in_past", earliestRaceDate };
  if (weekdayOf(raceDate) !== 6) return { ok: false, reason: "not_sunday", earliestRaceDate };
  const startDate = startFromRaceDate(raceDate, raceWeek);
  if (startDate < earliestStart(today)) return { ok: false, reason: "too_soon", earliestRaceDate };
  return { ok: true, startDate, raceDate };
}
