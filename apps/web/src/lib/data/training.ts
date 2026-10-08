import "server-only";
import {
  assignPlan,
  trainingProfileSchema,
  type AssignmentResult,
  type DistanceCode,
  type Level,
  type PlanVersion,
  type TrainingProfile,
} from "@runner360/training-engine";
import {
  toEnginePlanVersion,
  type CalendarRow,
  type ExerciseRow,
  type PlanRow,
  type PlanVersionRow,
  type PlanWeekRow,
  type SessionRow,
  type TrainingProfileRow,
  type UserPlanRow,
  type VariantRow,
  type WorkoutRow,
} from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export function rowToTrainingProfile(row: TrainingProfileRow, birthDate: string): TrainingProfile {
  return trainingProfileSchema.parse({
    birthDate,
    targetDistance: row.target_distance,
    level: row.level,
    experience: row.experience,
    weeklyKm: Number(row.weekly_km),
    availableWeekdays: row.available_weekdays,
    recentMark:
      row.recent_mark_distance_m && row.recent_mark_time_s
        ? { distanceM: row.recent_mark_distance_m, timeS: row.recent_mark_time_s, date: row.recent_mark_date }
        : null,
    goal: row.goal,
    raceDate: row.race_date,
    healthFlags: [],
  });
}

/** Perfil deportivo del usuario + antecedentes (solo visibles para el propio titular por RLS). */
export async function loadTrainingProfile(supabase: SupabaseClient, userId: string, birthDate: string | null) {
  const [{ data: row }, { data: health }] = await Promise.all([
    supabase.from("training_profiles").select("*").eq("user_id", userId).maybeSingle<TrainingProfileRow>(),
    supabase.from("health_screenings").select("flags").eq("user_id", userId).maybeSingle<{ flags: string[] }>(),
  ]);
  if (!row || !birthDate) return null;
  const profile = rowToTrainingProfile(row, birthDate);
  return { row, profile: { ...profile, healthFlags: trainingProfileSchema.shape.healthFlags.parse(health?.flags ?? []) } };
}

/** Carga versiones completas (semanas, sesiones, ejercicios, variantes). RLS decide qué contenido es visible. */
export async function loadPlanVersions(supabase: SupabaseClient, versionIds: string[]): Promise<PlanVersion[]> {
  if (versionIds.length === 0) return [];
  const { data: versions, error } = await supabase
    .from("training_plan_versions")
    .select("*, plan:training_plans(*)")
    .in("id", versionIds);
  if (error || !versions) return [];
  const [weeks, sessions, variants] = await Promise.all([
    supabase.from("training_plan_weeks").select("*").in("version_id", versionIds),
    supabase.from("training_sessions").select("*").in("version_id", versionIds),
    supabase.from("training_plan_schedule_variants").select("*").in("version_id", versionIds),
  ]);
  const sessionRows = (sessions.data ?? []) as SessionRow[];
  const exercises = sessionRows.length
    ? (((await supabase.from("training_session_exercises").select("*").in("session_id", sessionRows.map((s) => s.id))).data ?? []) as ExerciseRow[])
    : [];
  return (versions as (PlanVersionRow & { plan: PlanRow })[]).map((v) =>
    toEnginePlanVersion({
      plan: v.plan,
      version: v,
      weeks: ((weeks.data ?? []) as PlanWeekRow[]).filter((w) => w.version_id === v.id),
      sessions: sessionRows.filter((s) => s.version_id === v.id),
      exercises,
      variants: ((variants.data ?? []) as VariantRow[]).filter((x) => x.version_id === v.id),
    }),
  );
}

export interface CatalogEntry {
  versionId: string;
  planId: string;
  name: string;
  distance: DistanceCode;
  level: Level;
  durationWeeks: number;
  sessionsPerWeek: number;
  isDemo: boolean;
  isPremium: boolean;
  objective: string;
}

export async function loadCatalog(supabase: SupabaseClient): Promise<CatalogEntry[]> {
  const { data } = await supabase
    .from("training_plan_versions")
    .select("id, plan_id, name, duration_weeks, sessions_per_week, is_demo, objective, plan:training_plans(distance, level, is_premium)")
    .eq("status", "published");
  type Row = { id: string; plan_id: string; name: string; duration_weeks: number; sessions_per_week: number; is_demo: boolean; objective: string; plan: Pick<PlanRow, "distance" | "level" | "is_premium"> };
  const order = ["5K", "10K", "15K", "21K", "42K"];
  const levels = ["beginner", "intermediate", "advanced"];
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({
      versionId: r.id,
      planId: r.plan_id,
      name: r.name,
      distance: r.plan.distance,
      level: r.plan.level,
      durationWeeks: r.duration_weeks,
      sessionsPerWeek: r.sessions_per_week,
      isDemo: r.is_demo,
      isPremium: r.plan.is_premium,
      objective: r.objective,
    }))
    .sort((a, b) => order.indexOf(a.distance) - order.indexOf(b.distance) || levels.indexOf(a.level) - levels.indexOf(b.level));
}

export type EnrollmentOutcome =
  | { kind: "enrolled"; userPlanId: string; result: Extract<AssignmentResult, { kind: "assigned" }> }
  | { kind: "premium_required"; versionName: string }
  | { kind: "content_unavailable" }
  | { kind: "error"; message: string }
  | Exclude<AssignmentResult, { kind: "assigned" }>;

/**
 * Evalúa (y opcionalmente ejecuta) la asignación de plan con el motor.
 * Toda la lógica de negocio vive en @runner360/training-engine; acá solo se cargan datos y se persiste.
 * Las escrituras usan la sesión del usuario: RLS y los triggers validan nuevamente en la base.
 */
export async function evaluateEnrollment(params: {
  supabase: SupabaseClient;
  userId: string;
  profile: TrainingProfile;
  today: string;
  hasPremium: boolean;
  versionId?: string;
  commit: boolean;
}): Promise<EnrollmentOutcome> {
  const { supabase, profile, today } = params;
  const catalog = await loadCatalog(supabase);
  const candidates = params.versionId
    ? catalog.filter((c) => c.versionId === params.versionId)
    : catalog.filter((c) => c.distance === profile.targetDistance && c.level === profile.level);
  if (candidates.length === 0) return { kind: "no_published_plan" };

  const versions = await loadPlanVersions(supabase, candidates.map((c) => c.versionId));
  const result = assignPlan({ profile, catalog: versions, today, versionId: params.versionId });
  if (result.kind !== "assigned") return result;

  if (result.version.isPremium && !params.hasPremium) return { kind: "premium_required", versionName: result.version.name };
  if (result.version.sessions.length !== result.version.durationWeeks * result.version.sessionsPerWeek) {
    return { kind: "content_unavailable" };
  }
  if (!params.commit) return { kind: "enrolled", userPlanId: "", result };

  // Cierra la inscripción activa anterior (el historial se conserva).
  const { error: cancelError } = await supabase
    .from("user_training_plans")
    .update({ status: "cancelled" })
    .eq("user_id", params.userId)
    .eq("status", "active");
  if (cancelError) return { kind: "error", message: "No pudimos cerrar tu plan anterior." };

  const { data: userPlan, error: planError } = await supabase
    .from("user_training_plans")
    .insert({
      user_id: params.userId,
      plan_version_id: result.version.id,
      variant_id: result.variant.id,
      start_date: result.startDate,
      start_week: result.startWeek,
      race_date: profile.raceDate,
    })
    .select("id")
    .single<{ id: string }>();
  if (planError || !userPlan) return { kind: "error", message: "No pudimos crear tu inscripción." };

  const rows = result.calendar.map((e) => ({
    user_plan_id: userPlan.id,
    user_id: params.userId,
    session_id: e.sessionId,
    week_number: e.weekNumber,
    session_number: e.sessionNumber,
    scheduled_date: e.scheduledDate,
  }));
  const { error: calError } = await supabase.from("user_training_calendar").insert(rows);
  if (calError) {
    await supabase.from("user_training_plans").update({ status: "cancelled" }).eq("id", userPlan.id);
    return { kind: "error", message: "No pudimos generar tu calendario." };
  }
  return { kind: "enrolled", userPlanId: userPlan.id, result };
}

export interface CalendarItemView extends CalendarRow {
  session: SessionRow;
  workout: Pick<WorkoutRow, "id" | "distance_m" | "duration_s" | "rpe" | "status"> | null;
}

export interface ActivePlanView {
  userPlan: UserPlanRow;
  version: PlanVersion;
  planName: string;
  calendar: CalendarItemView[];
}

/** Inscripción activa con su versión congelada y el calendario completo. */
export async function loadActivePlan(supabase: SupabaseClient, userId: string): Promise<ActivePlanView | null> {
  const { data: userPlan } = await supabase
    .from("user_training_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle<UserPlanRow>();
  if (!userPlan) return null;
  const [versions, { data: calendar }, { data: workouts }] = await Promise.all([
    loadPlanVersions(supabase, [userPlan.plan_version_id]),
    supabase.from("user_training_calendar").select("*").eq("user_plan_id", userPlan.id).order("scheduled_date"),
    supabase
      .from("workout_logs")
      .select("id, calendar_entry_id, distance_m, duration_s, rpe, status")
      .eq("user_id", userId)
      .not("calendar_entry_id", "is", null),
  ]);
  const version = versions[0];
  if (!version) return null;
  const { data: sessions } = await supabase.from("training_sessions").select("*").eq("version_id", version.id);
  const sessionById = new Map(((sessions ?? []) as SessionRow[]).map((s) => [s.id, s]));
  const workoutByEntry = new Map(
    ((workouts ?? []) as (Pick<WorkoutRow, "id" | "distance_m" | "duration_s" | "rpe" | "status"> & { calendar_entry_id: string })[]).map((w) => [w.calendar_entry_id, w]),
  );
  const items: CalendarItemView[] = [];
  for (const c of (calendar ?? []) as CalendarRow[]) {
    const session = sessionById.get(c.session_id);
    if (session) items.push({ ...c, session, workout: workoutByEntry.get(c.id) ?? null });
  }
  return { userPlan, version, planName: version.name, calendar: items };
}

export async function loadWorkouts(supabase: SupabaseClient, userId: string, sinceDate?: string): Promise<WorkoutRow[]> {
  let q = supabase.from("workout_logs").select("*").eq("user_id", userId).order("workout_date", { ascending: false }).order("created_at", { ascending: false });
  if (sinceDate) q = q.gte("workout_date", sinceDate);
  const { data } = await q.limit(1000);
  return (data ?? []) as WorkoutRow[];
}
