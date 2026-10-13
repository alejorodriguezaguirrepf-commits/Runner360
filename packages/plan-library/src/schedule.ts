import { addDays, daysBetween, mondayOf, weekdayOf } from "./dates";
import type { SessionCategory } from "./schema";

/**
 * Calendario de una inscripción. No se guardan filas por día: las fechas se calculan a partir de
 * la inscripción (inicio + mapeo de días) y de las decisiones de los check-ins semanales.
 */

/** day_map[i] = día de la semana (0 = lunes … 6 = domingo) en el que se hace el día i del plan. */
export type DayMap = readonly number[];
export const IDENTITY_DAY_MAP: DayMap = [0, 1, 2, 3, 4, 5, 6];

/** Lo mínimo de un día del plan para validar el mapeo. */
export type DayShape = { week: number; day_index: number; is_rest: boolean; category: SessionCategory | null; is_quality: boolean | null };

export function isDemandingShape(d: DayShape): boolean {
  return !d.is_rest && (d.is_quality === true || d.category === "thr" || d.category === "hard" || d.category === "race");
}

export function isPermutation(map: DayMap): boolean {
  return map.length === 7 && [...map].sort((a, b) => a - b).every((v, i) => v === i);
}

export type DayMapViolation = "not_permutation" | "consecutive_demanding" | "race_moved";

/**
 * Regla de "mover días" (practical_rules): entre dos sesiones exigentes tiene que quedar al menos un
 * día fácil o de descanso, también entre el domingo y el lunes siguiente. La competencia no se mueve.
 * La base aplica la misma regla (library_day_map_violations).
 */
export function dayMapViolations(days: DayShape[], map: DayMap): DayMapViolation[] {
  if (!isPermutation(map)) return ["not_permutation"];
  const out = new Set<DayMapViolation>();
  const placed = days
    .map((d) => ({ d, pos: (d.week - 1) * 7 + map[d.day_index]! }))
    .sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < placed.length; i++) {
    const cur = placed[i]!;
    if (cur.d.category === "race" && map[cur.d.day_index] !== cur.d.day_index) out.add("race_moved");
    const prev = placed[i - 1];
    if (prev && prev.pos === cur.pos - 1 && isDemandingShape(prev.d) && isDemandingShape(cur.d)) out.add("consecutive_demanding");
  }
  return [...out];
}

// ---------------------------------------------------------------- Calendario
export type ScheduleDecision = "advance" | "repeat" | "reduce" | "regress" | "pause" | "resume";
export type CheckinLike = { week_start: string; decision: ScheduleDecision; next_week_start: string | null; next_plan_week: number | null; created_at?: string };
export type EnrollmentLike = { start_date: string; day_map: DayMap };

/** Tramo del calendario: desde `start` (lunes) se hace `planWeek`, y luego una semana por semana. null = pausa. */
export type Segment = { start: string; planWeek: number | null };

export function segmentsOf(enrollment: EnrollmentLike, checkins: CheckinLike[]): Segment[] {
  const segs: Segment[] = [{ start: enrollment.start_date, planWeek: 1 }];
  const sorted = [...checkins]
    .filter((c) => c.next_week_start !== null || c.decision === "pause")
    .sort((a, b) => (a.week_start === b.week_start ? (a.created_at ?? "").localeCompare(b.created_at ?? "") : a.week_start.localeCompare(b.week_start)));
  for (const c of sorted) {
    // La pausa rige desde la semana en que se registró (p. ej. por dolor > 5): esa semana queda en pausa.
    const start = c.decision === "pause" ? c.week_start : c.next_week_start!;
    // Un tramo nuevo reemplaza a los que empezaban en la misma fecha o después.
    while (segs.length > 1 && segs[segs.length - 1]!.start >= start) segs.pop();
    segs.push({ start, planWeek: c.decision === "pause" ? null : c.next_plan_week });
  }
  return segs;
}

export type ScheduledWeek = { weekStart: string; planWeek: number | null };

/** Semana del plan que corresponde al lunes `weekStart` (null = pausa; undefined = antes de empezar o terminado). */
export function planWeekAt(segments: Segment[], weekStart: string, durationWeeks: number): number | null | undefined {
  let seg: Segment | undefined;
  for (const s of segments) if (s.start <= weekStart) seg = s;
  if (!seg) return undefined;
  if (seg.planWeek === null) return null;
  const n = seg.planWeek + Math.floor(daysBetween(seg.start, weekStart) / 7);
  return n >= 1 && n <= durationWeeks ? n : undefined;
}

export type ScheduledDay = { date: string; planWeek: number; dayIndex: number };

/** Día del plan que toca en una fecha (o null si no hay: antes del inicio, pausa o plan terminado). */
export function planDayAt(enrollment: EnrollmentLike, segments: Segment[], durationWeeks: number, date: string): ScheduledDay | null {
  const week = planWeekAt(segments, mondayOf(date), durationWeeks);
  if (week === null || week === undefined) return null;
  const dayIndex = enrollment.day_map.indexOf(weekdayOf(date));
  return dayIndex < 0 ? null : { date, planWeek: week, dayIndex };
}

/** Fecha en la que cae el día `dayIndex` del plan dentro de la semana que empieza en `weekStart`. */
export function dateOfPlanDay(enrollment: EnrollmentLike, weekStart: string, dayIndex: number): string {
  return addDays(weekStart, enrollment.day_map[dayIndex]!);
}

/** Lunes en que se hace cada semana del plan, en orden de calendario (las repetidas aparecen más de una vez). */
export function scheduledWeeks(segments: Segment[], durationWeeks: number, limitWeeks = 120): ScheduledWeek[] {
  const out: ScheduledWeek[] = [];
  let week = segments[0]!.start;
  for (let i = 0; i < limitWeeks; i++) {
    const n = planWeekAt(segments, week, durationWeeks);
    if (n === undefined) {
      const later = segments.some((s) => s.start > week);
      if (!later) break;
    } else out.push({ weekStart: week, planWeek: n });
    week = addDays(week, 7);
  }
  return out;
}

/** Fecha en que quedaría la competencia con las repeticiones registradas (domingo de la semana RACE). */
export function projectedRaceDate(segments: Segment[], durationWeeks: number, raceWeek: number): string | null {
  const weeks = scheduledWeeks(segments, durationWeeks);
  const last = [...weeks].reverse().find((w) => w.planWeek === raceWeek);
  return last ? addDays(last.weekStart, 6) : null;
}
