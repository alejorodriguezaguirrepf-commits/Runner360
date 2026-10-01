import { monthKey, startOfIsoWeek, toLocalDateKey, type DateKey } from "./dates";

/** Ritmo medio en segundos por km. Devuelve null si no es calculable (distancia o duración no positivas). */
export function paceSecondsPerKm(distanceM: number, durationS: number): number | null {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (durationS * 1000) / distanceM;
}

/** Velocidad media en km/h. */
export function speedKmh(distanceM: number, durationS: number): number | null {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (distanceM / durationS) * 3.6;
}

export interface WorkoutLike {
  startedAt: string;
  distanceM: number;
  durationS: number;
  status: "completed" | "modified" | "skipped";
  calendarEntryId?: string | null;
  rpe?: number | null;
}

export interface PeriodTotal {
  key: string;
  distanceM: number;
  durationS: number;
  workouts: number;
}

function aggregate(
  logs: WorkoutLike[],
  keyOf: (localDate: DateKey) => string,
  timeZone: string,
): PeriodTotal[] {
  const map = new Map<string, PeriodTotal>();
  for (const l of logs) {
    if (l.status === "skipped") continue;
    const key = keyOf(toLocalDateKey(l.startedAt, timeZone));
    const cur = map.get(key) ?? { key, distanceM: 0, durationS: 0, workouts: 0 };
    cur.distanceM += Math.max(0, Math.trunc(l.distanceM));
    cur.durationS += Math.max(0, Math.trunc(l.durationS));
    cur.workouts += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Totales por semana ISO (clave = lunes de la semana, en la zona horaria del usuario). */
export function weeklyTotals(logs: WorkoutLike[], timeZone = "America/Argentina/Buenos_Aires"): PeriodTotal[] {
  return aggregate(logs, startOfIsoWeek, timeZone);
}

/** Totales por mes (clave = YYYY-MM). */
export function monthlyTotals(logs: WorkoutLike[], timeZone = "America/Argentina/Buenos_Aires"): PeriodTotal[] {
  return aggregate(logs, monthKey, timeZone);
}

export function totals(logs: WorkoutLike[]): { distanceM: number; durationS: number; workouts: number } {
  return logs
    .filter((l) => l.status !== "skipped")
    .reduce(
      (a, l) => ({
        distanceM: a.distanceM + Math.max(0, Math.trunc(l.distanceM)),
        durationS: a.durationS + Math.max(0, Math.trunc(l.durationS)),
        workouts: a.workouts + 1,
      }),
      { distanceM: 0, durationS: 0, workouts: 0 },
    );
}

/** Completa con ceros las semanas sin registros entre dos lunes (para gráficos continuos). */
export function fillWeeks(totalsByWeek: PeriodTotal[], fromMonday: DateKey, toMonday: DateKey): PeriodTotal[] {
  const map = new Map(totalsByWeek.map((t) => [t.key, t]));
  const out: PeriodTotal[] = [];
  let cur = fromMonday;
  let guard = 0;
  while (cur <= toMonday && guard++ < 520) {
    out.push(map.get(cur) ?? { key: cur, distanceM: 0, durationS: 0, workouts: 0 });
    const d = new Date(`${cur}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    cur = d.toISOString().slice(0, 10);
  }
  return out;
}

export interface CalendarEntryStatus {
  id: string;
  scheduledDate: DateKey;
  isRest: boolean;
  /** Estado del registro asociado, si existe. */
  logStatus: "completed" | "modified" | "skipped" | null;
}

export interface Compliance {
  due: number;
  completed: number;
  modified: number;
  skipped: number;
  pending: number;
  /** (completadas + modificadas) / vencidas. null si no hay sesiones vencidas. */
  rate: number | null;
}

/**
 * Cumplimiento del plan hasta `today` inclusive. Las sesiones de descanso no cuentan.
 * Una sesión vencida sin registro cuenta como no realizada (pending se refiere a hoy sin registro).
 */
export function computeCompliance(entries: CalendarEntryStatus[], today: DateKey): Compliance {
  let due = 0;
  let completed = 0;
  let modified = 0;
  let skipped = 0;
  let pending = 0;
  for (const e of entries) {
    if (e.isRest || e.scheduledDate > today) continue;
    if (e.scheduledDate === today && e.logStatus == null) {
      pending++;
      continue;
    }
    due++;
    if (e.logStatus === "completed") completed++;
    else if (e.logStatus === "modified") modified++;
    else skipped++;
  }
  return { due, completed, modified, skipped, pending, rate: due === 0 ? null : (completed + modified) / due };
}

/** Porcentaje de semanas (de las últimas N) con al menos un entrenamiento registrado. */
export function consistency(weekly: PeriodTotal[], lastWeeks: number): number | null {
  if (lastWeeks <= 0) return null;
  const window = weekly.slice(-lastWeeks);
  if (window.length === 0) return null;
  return window.filter((w) => w.workouts > 0).length / window.length;
}

export interface ResultLike {
  distanceM: number;
  finishTimeS: number;
  raceDate: DateKey;
  name: string;
}

/** Mejores marcas por distancia exacta (resultados reales, no estimaciones). */
export function personalBests<T extends ResultLike>(results: T[]): T[] {
  const best = new Map<number, T>();
  for (const r of results) {
    if (r.finishTimeS <= 0 || r.distanceM <= 0) continue;
    const cur = best.get(r.distanceM);
    if (!cur || r.finishTimeS < cur.finishTimeS) best.set(r.distanceM, r);
  }
  return [...best.values()].sort((a, b) => a.distanceM - b.distanceM);
}
