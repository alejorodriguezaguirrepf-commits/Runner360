import "server-only";
import {
  addDays,
  computeCompliance,
  consistency,
  currentPlanWeek,
  diffDays,
  evaluateProgression,
  mondayOf,
  totals,
  weeklyTotals,
  type LogItem,
  type ProgressionDecision,
} from "@runner360/training-engine";
import type { WorkoutRow } from "@runner360/shared";
import type { ActivePlanView, CalendarItemView } from "./training";

export function toLogItems(workouts: WorkoutRow[]): LogItem[] {
  return workouts.map((w) => ({ date: w.workout_date, distanceM: w.distance_m, durationS: w.duration_s, status: w.status }));
}

export interface DashboardData {
  today: string;
  todaySessions: CalendarItemView[];
  nextSession: CalendarItemView | null;
  planWeek: number | null;
  week: {
    plannedSessions: number;
    doneSessions: number;
    plannedDurationS: number;
    plannedDistanceM: number;
    doneDistanceM: number;
    doneDurationS: number;
  };
  compliance: ReturnType<typeof computeCompliance> | null;
  planProgress: number | null;
  daysToRace: number | null;
  recommendation: ProgressionDecision | null;
  consistency: ReturnType<typeof consistency>;
  totals30d: ReturnType<typeof totals>;
}

/** Todo lo que muestra el inicio, derivado de registros reales con funciones del motor. */
export function buildDashboard(active: ActivePlanView | null, workouts: WorkoutRow[], today: string): DashboardData {
  const logs = toLogItems(workouts);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const thisWeekLogs = weeklyTotals(logs, today, today)[0] ?? { distanceM: 0, durationS: 0, workouts: 0 };
  const cal = active?.calendar ?? [];
  const weekItems = cal.filter((c) => c.scheduled_date >= weekStart && c.scheduled_date <= weekEnd);

  let recommendation: ProgressionDecision | null = null;
  let planWeek: number | null = null;
  let planProgress: number | null = null;
  if (active) {
    const { userPlan, version } = active;
    planWeek = currentPlanWeek({ startDate: userPlan.start_date, startWeek: userPlan.start_week, durationWeeks: version.durationWeeks, today });
    const totalDays = (version.durationWeeks - userPlan.start_week + 1) * 7;
    planProgress = Math.min(1, Math.max(0, diffDays(userPlan.start_date, today) / totalDays));

    // Recomendación sobre la semana anterior completa (solo sugerencia, nunca se aplica sola).
    const prevStart = addDays(weekStart, -7);
    const prevItems = cal.filter((c) => c.scheduled_date >= prevStart && c.scheduled_date < weekStart);
    if (prevItems.length > 0) {
      const prevWorkouts = workouts.filter((w) => w.workout_date >= prevStart && w.workout_date < weekStart && w.status !== "skipped");
      const rpes = prevWorkouts.map((w) => w.rpe).filter((r): r is number => r !== null);
      recommendation = evaluateProgression(version.progressionRules, {
        planned: prevItems.length,
        done: prevItems.filter((c) => c.status === "completed" || c.status === "modified").length,
        avgRpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
        painReported: prevWorkouts.some((w) => w.pain_reported),
      });
    }
  }

  const raceDate = active?.userPlan.race_date ?? null;
  return {
    today,
    todaySessions: cal.filter((c) => c.scheduled_date === today),
    nextSession: cal.find((c) => c.scheduled_date >= today && c.status === "pending" && c.scheduled_date !== today) ?? null,
    planWeek,
    week: {
      plannedSessions: weekItems.length,
      doneSessions: weekItems.filter((c) => c.status === "completed" || c.status === "modified").length,
      plannedDurationS: weekItems.reduce((a, c) => a + (c.session.duration_s ?? 0), 0),
      plannedDistanceM: weekItems.reduce((a, c) => a + (c.session.distance_m ?? 0), 0),
      doneDistanceM: thisWeekLogs.distanceM,
      doneDurationS: thisWeekLogs.durationS,
    },
    compliance: active ? computeCompliance(cal.map((c) => ({ scheduledDate: c.scheduled_date, status: c.status })), today) : null,
    planProgress,
    daysToRace: raceDate && raceDate >= today ? diffDays(today, raceDate) : null,
    recommendation,
    consistency: consistency(logs, today, 8),
    totals30d: totals(logs.filter((l) => l.date > addDays(today, -30))),
  };
}
