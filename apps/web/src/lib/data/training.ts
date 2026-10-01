import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RaceDistance, RunnerLevel, SessionType, Intensity, WorkoutStatus, TrainingGoal } from "@runner360/shared";
import type { RunnerProfile } from "@runner360/training-engine";
import { SESSION_COLUMNS, sessionFromRow, VERSION_COLUMNS, versionFromRow, type SessionRow, type VersionRow } from "./plans";

export interface TrainingProfileRow {
  target_distance: RaceDistance;
  level: RunnerLevel;
  experience_months: number;
  weekly_distance_m: number;
  available_days: number[];
  recent_race_distance_m: number | null;
  recent_race_time_s: number | null;
  goal: TrainingGoal;
  race_date: string | null;
  preferences: string | null;
}

export async function loadRunnerProfile(sb: SupabaseClient, userId: string) {
  const [{ data: tp }, { data: health }] = await Promise.all([
    sb.from("training_profiles").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("training_health_info").select("has_recent_injury, has_medical_condition, notes").eq("user_id", userId).maybeSingle(),
  ]);
  if (!tp) return null;
  const row = tp as TrainingProfileRow;
  const runner: RunnerProfile = {
    targetDistance: row.target_distance,
    level: row.level,
    experienceMonths: row.experience_months,
    weeklyDistanceM: row.weekly_distance_m,
    availableDays: row.available_days,
    raceDate: row.race_date,
    hasRecentInjury: Boolean(health?.has_recent_injury),
    hasMedicalCondition: Boolean(health?.has_medical_condition),
  };
  return { row, runner, health: health as { has_recent_injury: boolean; has_medical_condition: boolean; notes: string | null } | null };
}

export interface CalendarItem {
  id: string;
  scheduledDate: string;
  weekNumber: number;
  session: {
    id: string;
    type: SessionType;
    title: string;
    objective: string;
    distanceM: number | null;
    durationS: number | null;
    intensity: Intensity;
    rpeMin: number | null;
    rpeMax: number | null;
    warmup: string;
    mainSet: string;
    cooldown: string;
    notes: string;
  };
  log: { id: string; status: WorkoutStatus; distanceM: number; durationS: number; rpe: number | null } | null;
}

export interface ActivePlan {
  id: string;
  startDate: string;
  startWeek: number;
  raceDate: string | null;
  weekdayPattern: number[];
  version: ReturnType<typeof versionFromRow>;
  calendar: CalendarItem[];
}

type LogEmbed = { id: string; status: WorkoutStatus; distance_m: number; duration_s: number; rpe: number | null };

type CalendarRow = {
  id: string;
  scheduled_date: string;
  week_number: number;
  training_sessions: SessionRow;
  workout_logs: LogEmbed[] | LogEmbed | null;
};

/** Plan activo del usuario con calendario y registros vinculados. */
export async function loadActivePlan(sb: SupabaseClient, userId: string): Promise<ActivePlan | null> {
  const { data: up } = await sb
    .from("user_training_plans")
    .select("id, plan_version_id, start_date, start_week, race_date, weekday_pattern")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!up) return null;
  const [{ data: v }, { data: cal }] = await Promise.all([
    sb.from("training_plan_versions").select(VERSION_COLUMNS).eq("id", up.plan_version_id).maybeSingle(),
    sb
      .from("user_training_calendar")
      .select(`id, scheduled_date, week_number, training_sessions(${SESSION_COLUMNS}), workout_logs(id, status, distance_m, duration_s, rpe)`)
      .eq("user_plan_id", up.id)
      .order("scheduled_date"),
  ]);
  if (!v) return null;
  return {
    id: up.id as string,
    startDate: up.start_date as string,
    startWeek: up.start_week as number,
    raceDate: (up.race_date as string | null) ?? null,
    weekdayPattern: up.weekday_pattern as number[],
    version: versionFromRow(v as unknown as VersionRow),
    calendar: ((cal ?? []) as unknown as CalendarRow[]).map((c) => {
      const s = sessionFromRow(c.training_sessions);
      // PostgREST puede devolver arreglo u objeto según detecte la relación (1:1 o 1:N).
      const log = Array.isArray(c.workout_logs) ? c.workout_logs[0] : (c.workout_logs ?? undefined);
      return {
        id: c.id,
        scheduledDate: c.scheduled_date,
        weekNumber: c.week_number,
        session: {
          id: s.id!,
          type: s.type,
          title: s.title,
          objective: s.objective,
          distanceM: s.distanceM,
          durationS: s.durationS,
          intensity: s.intensity,
          rpeMin: s.rpeMin,
          rpeMax: s.rpeMax,
          warmup: s.warmup,
          mainSet: s.mainSet,
          cooldown: s.cooldown,
          notes: s.notes,
        },
        log: log ? { id: log.id, status: log.status, distanceM: log.distance_m, durationS: log.duration_s, rpe: log.rpe } : null,
      };
    }),
  };
}

export interface WorkoutRow {
  id: string;
  started_at: string;
  distance_m: number;
  duration_s: number;
  avg_pace_s_per_km: string | number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  rpe: number | null;
  notes: string | null;
  status: WorkoutStatus;
  calendar_entry_id: string | null;
}

export async function loadWorkouts(sb: SupabaseClient, userId: string, sinceIso?: string, limit = 500): Promise<WorkoutRow[]> {
  let q = sb
    .from("workout_logs")
    .select("id, started_at, distance_m, duration_s, avg_pace_s_per_km, avg_hr, max_hr, elevation_gain_m, rpe, notes, status, calendar_entry_id")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (sinceIso) q = q.gte("started_at", sinceIso);
  const { data } = await q;
  return (data ?? []) as WorkoutRow[];
}

export function toWorkoutLike(w: WorkoutRow) {
  return { startedAt: w.started_at, distanceM: w.distance_m, durationS: w.duration_s, status: w.status, calendarEntryId: w.calendar_entry_id, rpe: w.rpe };
}
