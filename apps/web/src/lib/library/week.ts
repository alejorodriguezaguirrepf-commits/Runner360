import "server-only";
import {
  addDays,
  evaluateWeek,
  mondayOf,
  planDayAt,
  planWeekAt,
  resumeWeek,
  ruleText,
  type CheckinLike,
  type PlannedSession,
  type RedFlag,
  type SessionLog,
  type WeekContext,
  type WeekEvaluation,
} from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmt, t } from "@/i18n";
import type { OpenEnrollment } from "@/lib/data/enrollment";
import { getPlanWeeks, getWeekDays, type DayRow, type WeekRow } from "@/lib/data/library";

export type LogRow = {
  id: string;
  workout_date: string;
  status: "completed" | "modified" | "skipped";
  duration_s: number | null;
  distance_m: number | null;
  rpe: number | null;
  pain_score: number | null;
  red_flags: RedFlag[];
  sleep_quality: "good" | "fair" | "poor" | null;
  comments: string | null;
  plan_week: number | null;
  plan_day_index: number | null;
};

export const LOG_COLUMNS = "id, workout_date, status, duration_s, distance_m, rpe, pain_score, red_flags, sleep_quality, comments, plan_week, plan_day_index";

export async function getLogs(supabase: SupabaseClient, enrollmentId: string, from: string, to: string): Promise<LogRow[]> {
  const { data } = await supabase
    .from("workout_logs")
    .select(LOG_COLUMNS)
    .eq("enrollment_id", enrollmentId)
    .gte("workout_date", from)
    .lte("workout_date", to)
    .order("workout_date");
  return (data ?? []) as LogRow[];
}

/** Última fecha con un entrenamiento hecho (cualquier registro, del plan o libre). */
export async function lastTrainingDate(supabase: SupabaseClient, userId: string, before: string): Promise<string | null> {
  const { data } = await supabase
    .from("workout_logs")
    .select("workout_date")
    .eq("user_id", userId)
    .neq("status", "skipped")
    .lte("workout_date", before)
    .order("workout_date", { ascending: false })
    .limit(1)
    .maybeSingle<{ workout_date: string }>();
  return data?.workout_date ?? null;
}

export type WeekData = {
  weekStart: string;
  planWeek: number;
  week: WeekRow | null;
  days: DayRow[];
  /** Días ordenados por fecha real. */
  dated: { day: DayRow; date: string }[];
  logs: LogRow[];
};

export async function loadWeek(supabase: SupabaseClient, open: OpenEnrollment, weekStart: string): Promise<WeekData | null> {
  const planWeek = planWeekAt(open.segments, weekStart, open.plan.duration_weeks);
  if (typeof planWeek !== "number") return null;
  const [weeks, days, logs] = await Promise.all([
    getPlanWeeks(open.enrollment.content_version, open.plan.id),
    getWeekDays(supabase, open.enrollment.content_version, open.plan.id, planWeek),
    getLogs(supabase, open.enrollment.id, weekStart, addDays(weekStart, 6)),
  ]);
  const dated = days
    .map((day) => ({ day, date: addDays(weekStart, open.enrollment.day_map[day.day_index]!) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { weekStart, planWeek, week: weeks?.find((w) => w.week === planWeek) ?? null, days, dated, logs };
}

export function toSessionLogs(data: WeekData): SessionLog[] {
  return data.logs
    .filter((l) => l.plan_day_index !== null)
    .map((l) => ({
      date: l.workout_date,
      planDayIndex: l.plan_day_index!,
      status: l.status,
      rpe: l.rpe,
      pain: l.pain_score,
      redFlags: l.red_flags ?? [],
      sleep: l.sleep_quality,
      category: data.days.find((d) => d.day_index === l.plan_day_index)?.category ?? null,
    }));
}

export function plannedSessions(data: WeekData): PlannedSession[] {
  return data.dated
    .filter(({ day }) => !day.is_rest && day.category)
    .map(({ day, date }) => ({ date, dayIndex: day.day_index, category: day.category!, isQuality: day.is_quality === true }));
}

export async function deloadWeeks(open: OpenEnrollment): Promise<number[]> {
  const weeks = await getPlanWeeks(open.enrollment.content_version, open.plan.id);
  return (weeks ?? []).filter((w) => w.week_type.startsWith("D")).map((w) => w.week);
}

/** Contexto del motor de reglas para una semana (con la respuesta al criterio, si ya la hay). */
export async function weekEvaluation(
  supabase: SupabaseClient,
  open: OpenEnrollment,
  data: WeekData,
  today: string,
  criterionMet: boolean | null,
): Promise<{ context: WeekContext; evaluation: WeekEvaluation }> {
  const previous = [...open.checkins].reverse().find((c) => c.week_start < data.weekStart);
  const context: WeekContext = {
    today,
    weekStart: data.weekStart,
    planWeek: data.planWeek,
    planned: plannedSessions(data),
    logs: toSessionLogs(data),
    criterionMet,
    previousCriterionMet: previous?.criterion_met ?? null,
    lastTrainingDate: await lastTrainingDate(supabase, open.enrollment.user_id, today),
    deloadWeeks: await deloadWeeks(open),
  };
  return { context, evaluation: evaluateWeek(context) };
}

/**
 * Semana con check-in pendiente: la anterior (si fue del plan y no tiene check-in) o la actual
 * desde el sábado.
 */
export function pendingCheckinWeek(open: OpenEnrollment, today: string, weekday: number): string | null {
  const thisMonday = mondayOf(today);
  const done = (w: string) => open.checkins.some((c: CheckinLike) => c.week_start === w && c.decision !== "pause" && c.decision !== "resume");
  const prev = addDays(thisMonday, -7);
  if (typeof planWeekAt(open.segments, prev, open.plan.duration_weeks) === "number" && !done(prev) && prev >= open.enrollment.start_date) return prev;
  if (weekday >= 5 && typeof planWeekAt(open.segments, thisMonday, open.plan.duration_weeks) === "number" && !done(thisMonday)) return thisMonday;
  return null;
}

/** Semana desde la que se retoma después de una pausa (reglas prácticas según el tiempo sin entrenar). */
export async function resumeTarget(supabase: SupabaseClient, open: OpenEnrollment, today: string): Promise<number> {
  const lastPlanWeek = [...open.checkins].reverse().find((c) => c.plan_week)?.plan_week ?? 1;
  return resumeWeek(lastPlanWeek, await lastTrainingDate(supabase, open.enrollment.user_id, today), today, await deloadWeeks(open));
}

/** Datos para la tarjeta de check-in: la recomendación si cumplió el criterio y si no lo cumplió. */
export async function checkinProps(supabase: SupabaseClient, open: OpenEnrollment, weekStart: string, today: string) {
  const data = await loadWeek(supabase, open, weekStart);
  if (!data || !data.week) return null;
  const toOption = (e: WeekEvaluation) => ({
    recommendation: e.recommendation,
    regressTo: e.regressTo,
    texts: e.hits.map((h) => ruleText(h.source, open.library.version)).filter((x): x is string => Boolean(x)),
  });
  const [yes, no] = await Promise.all([weekEvaluation(supabase, open, data, today, true), weekEvaluation(supabase, open, data, today, false)]);
  return { weekStart, planWeek: data.planWeek, criterion: data.week.progression_criterion, ifYes: toOption(yes.evaluation), ifNo: toOption(no.evaluation) };
}

/** Texto corto para el inicio: la sesión de hoy, descanso, pausa o cuándo empieza. */
export async function todaySummary(supabase: SupabaseClient, open: OpenEnrollment, today: string): Promise<string> {
  const T = t.library.today;
  if (open.enrollment.status === "paused") return T.paused;
  const slot = planDayAt(open.enrollment, open.segments, open.plan.duration_weeks, today);
  if (!slot) return today < open.enrollment.start_date ? fmt(T.notStarted, { date: formatDate(open.enrollment.start_date, "long") }) : T.finished;
  const day = (await getWeekDays(supabase, open.enrollment.content_version, open.plan.id, slot.planWeek)).find((d) => d.day_index === slot.dayIndex);
  if (!day) return T.locked;
  return day.is_rest ? (day.strength_only ? fmt(T.strengthOnly, { r: open.plan.strength_routine }) : T.rest) : `${day.session_type} · ${day.short_label}`;
}
