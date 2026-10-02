import { addDays, compareDates, diffDays, mondayOf, monthKey } from "./dates";

/**
 * Agregados de entrenamiento: cumplimiento, volumen semanal/mensual, tiempo acumulado y consistencia.
 * Todas las sumas se hacen sobre enteros (metros, segundos), sin errores de punto flotante.
 */

export type CalendarStatus = "pending" | "completed" | "modified" | "skipped";

export interface CalendarItem {
  scheduledDate: string;
  status: CalendarStatus;
  plannedDistanceM?: number | null;
  plannedDurationS?: number | null;
}

export interface Compliance {
  /** Sesiones con fecha <= asOf. */
  due: number;
  /** Completadas tal como estaban planificadas. */
  completed: number;
  /** Realizadas con modificaciones. */
  modified: number;
  skipped: number;
  /** Vencidas sin registro. */
  missed: number;
  /** (completadas + modificadas) / vencidas. `null` si no hay sesiones vencidas. */
  rate: number | null;
}

export function computeCompliance(items: readonly CalendarItem[], asOf: string): Compliance {
  let due = 0;
  let completed = 0;
  let modified = 0;
  let skipped = 0;
  let missed = 0;
  for (const it of items) {
    if (compareDates(it.scheduledDate, asOf) > 0) continue;
    due++;
    if (it.status === "completed") completed++;
    else if (it.status === "modified") modified++;
    else if (it.status === "skipped") skipped++;
    else missed++;
  }
  return { due, completed, modified, skipped, missed, rate: due === 0 ? null : (completed + modified) / due };
}

export interface LogItem {
  /** Fecha local del entrenamiento (YYYY-MM-DD). */
  date: string;
  distanceM: number | null;
  durationS: number | null;
  status: "completed" | "modified" | "skipped";
}

export interface PeriodTotals {
  key: string;
  distanceM: number;
  durationS: number;
  workouts: number;
}

function isCounted(l: LogItem): boolean {
  return l.status !== "skipped";
}

function accumulate(map: Map<string, PeriodTotals>, key: string, l: LogItem): void {
  const t = map.get(key) ?? { key, distanceM: 0, durationS: 0, workouts: 0 };
  t.distanceM += l.distanceM ?? 0;
  t.durationS += l.durationS ?? 0;
  t.workouts += 1;
  map.set(key, t);
}

/** Totales por semana (clave = lunes de la semana) entre `from` y `to` inclusive, sin huecos. */
export function weeklyTotals(logs: readonly LogItem[], from: string, to: string): PeriodTotals[] {
  const start = mondayOf(from);
  const end = mondayOf(to);
  const map = new Map<string, PeriodTotals>();
  for (let w = start; compareDates(w, end) <= 0; w = addDays(w, 7)) {
    map.set(w, { key: w, distanceM: 0, durationS: 0, workouts: 0 });
  }
  for (const l of logs) {
    if (!isCounted(l)) continue;
    const key = mondayOf(l.date);
    if (map.has(key)) accumulate(map, key, l);
  }
  return [...map.values()];
}

/** Totales por mes calendario (clave `YYYY-MM`), ordenados. */
export function monthlyTotals(logs: readonly LogItem[]): PeriodTotals[] {
  const map = new Map<string, PeriodTotals>();
  for (const l of logs) if (isCounted(l)) accumulate(map, monthKey(l.date), l);
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function totals(logs: readonly LogItem[]): Omit<PeriodTotals, "key"> {
  let distanceM = 0;
  let durationS = 0;
  let workouts = 0;
  for (const l of logs) {
    if (!isCounted(l)) continue;
    distanceM += l.distanceM ?? 0;
    durationS += l.durationS ?? 0;
    workouts++;
  }
  return { distanceM, durationS, workouts };
}

/**
 * Consistencia: proporción de semanas (de las últimas `weeks`, terminando en la semana de `asOf`)
 * con al menos un entrenamiento registrado.
 */
export function consistency(logs: readonly LogItem[], asOf: string, weeks = 8): { activeWeeks: number; weeks: number; rate: number } {
  const lastMonday = mondayOf(asOf);
  const firstMonday = addDays(lastMonday, -(weeks - 1) * 7);
  const active = new Set<string>();
  for (const l of logs) {
    if (!isCounted(l)) continue;
    const m = mondayOf(l.date);
    if (compareDates(m, firstMonday) >= 0 && compareDates(m, lastMonday) <= 0) active.add(m);
  }
  return { activeWeeks: active.size, weeks, rate: active.size / weeks };
}

/** Días consecutivos sin entrenar hasta `asOf` (útil para avisos suaves, no prescriptivos). */
export function daysSinceLastWorkout(logs: readonly LogItem[], asOf: string): number | null {
  let last: string | null = null;
  for (const l of logs) {
    if (!isCounted(l) || compareDates(l.date, asOf) > 0) continue;
    if (last === null || compareDates(l.date, last) > 0) last = l.date;
  }
  return last === null ? null : diffDays(last, asOf);
}
