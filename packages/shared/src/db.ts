/**
 * Tipos de filas de la base (snake_case, tal como los devuelve Supabase).
 * Mantener sincronizados con supabase/migrations. Próximo paso: reemplazar por
 * `supabase gen types typescript` cuando haya un proyecto Supabase vinculado.
 */
import type { DistanceCode, Intensity, Level, PlanVersionStatus, SessionType } from "@runner360/training-engine";

export type AppRole = "user" | "coach" | "admin";
export type CalendarStatusDb = "pending" | "completed" | "modified" | "skipped";
export type WorkoutStatusDb = "completed" | "modified" | "skipped";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  birth_date: string | null;
  role: AppRole;
  can_validate_plans: boolean;
  timezone: string;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface TrainingProfileRow {
  user_id: string;
  target_distance: DistanceCode;
  level: Level;
  experience: "none" | "lt_6m" | "6_12m" | "1_3y" | "gt_3y";
  weekly_km: number | string;
  available_weekdays: number[];
  recent_mark_distance_m: number | null;
  recent_mark_time_s: number | null;
  recent_mark_date: string | null;
  goal: "complete" | "improve" | "race";
  race_date: string | null;
  preferences: Record<string, unknown>;
  readiness: "ok" | "introductory_phase" | "professional_review";
  readiness_reasons: string[];
}

export interface PlanRow {
  id: string;
  slug: string;
  distance: DistanceCode;
  level: Level;
  name: string;
  description: string;
  is_premium: boolean;
}

export interface PlanVersionRow {
  id: string;
  plan_id: string;
  version_number: number;
  status: PlanVersionStatus;
  is_demo: boolean;
  name: string;
  objective: string;
  duration_weeks: number;
  sessions_per_week: number;
  entry_requirements: Record<string, unknown>;
  progression_rules: Record<string, unknown>;
  start_week_rules: unknown[];
  change_notes: string;
  validated_by: string | null;
  validated_at: string | null;
  published_at: string | null;
}

export interface PlanWeekRow {
  id: string;
  version_id: string;
  week_number: number;
  focus: string;
  notes: string;
}

export interface SessionRow {
  id: string;
  version_id: string;
  week_id: string;
  week_number: number;
  session_number: number;
  session_type: SessionType;
  title: string;
  objective: string;
  distance_m: number | null;
  duration_s: number | null;
  intensity: Intensity;
  rpe_min: number | null;
  rpe_max: number | null;
  warmup: string;
  main_set: string;
  cooldown: string;
  notes: string;
  progression_criteria: string;
  stop_criteria: string;
}

export interface ExerciseRow {
  id: string;
  session_id: string;
  position: number;
  name: string;
  sets: number | null;
  reps: number | null;
  duration_s: number | null;
  rest_s: number | null;
  notes: string;
}

export interface VariantRow {
  id: string;
  version_id: string;
  code: string;
  label: string;
  weekdays: number[];
  priority: number;
}

export interface UserPlanRow {
  id: string;
  user_id: string;
  plan_version_id: string;
  variant_id: string;
  start_date: string;
  start_week: number;
  race_date: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
}

export interface CalendarRow {
  id: string;
  user_plan_id: string;
  user_id: string;
  session_id: string;
  week_number: number;
  session_number: number;
  scheduled_date: string;
  status: CalendarStatusDb;
}

export interface WorkoutRow {
  id: string;
  user_id: string;
  calendar_entry_id: string | null;
  workout_date: string;
  started_at: string | null;
  status: WorkoutStatusDb;
  distance_m: number | null;
  duration_s: number | null;
  avg_pace_s_per_km: number | string | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  rpe: number | null;
  pain_reported: boolean;
  comments: string | null;
  created_at: string;
}

export interface HydrationLogRow {
  id: string;
  log_date: string;
  logged_at: string;
  beverage: "water" | "sports_drink" | "electrolytes" | "gel" | "other";
  context: "daily" | "training" | "competition";
  volume_ml: number;
  carbs_g: number | null;
  notes: string | null;
}

export interface HydrationReminderRow {
  id: string;
  label: string;
  time_of_day: string;
  weekdays: number[];
  enabled: boolean;
}

export interface CompetitionRow {
  id: string;
  user_id: string;
  name: string;
  distance_code: DistanceCode | null;
  distance_m: number;
  event_date: string;
  location: string | null;
  target_time_s: number | null;
  status: "planned" | "completed" | "dns" | "dnf";
  notes: string | null;
}

export interface CompetitionResultRow {
  id: string;
  competition_id: string;
  finish_time_s: number;
  is_official: boolean;
  notes: string | null;
}

export interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  billing_interval: "month" | "year" | null;
  features: string[];
  active: boolean;
  sort_order: number;
}

export interface PriceRow {
  id: string;
  product_id: string;
  currency: string;
  amount_minor: number;
  provider: "mercadopago" | "stripe" | "apple" | "google" | null;
  provider_price_id: string | null;
  active: boolean;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  product_id: string;
  provider: "mercadopago" | "stripe" | "apple" | "google" | "manual";
  status: "pending" | "trialing" | "active" | "past_due" | "cancelled" | "expired";
  started_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
}

export interface ContentRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: "hydration" | "training" | "injury_prevention" | "nutrition" | "general";
  is_premium: boolean;
  status: "draft" | "published" | "archived";
  reviewed_by: string | null;
  published_at: string | null;
}
