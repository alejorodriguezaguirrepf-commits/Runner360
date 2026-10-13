import "server-only";
import { segmentsOf, type CheckinLike, type ScheduleDecision, type Segment } from "@runner360/plan-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import { findPlan, getLibrary, type Library, type PlanRow } from "./library";

export type EnrollmentRow = {
  id: string;
  user_id: string;
  content_version: string;
  plan_id: string;
  start_date: string;
  race_date: string;
  day_map: number[];
  status: "active" | "paused" | "completed" | "cancelled";
  paused_at: string | null;
  mark_distance_m: number | null;
  mark_time_s: number | null;
  mark_date: string | null;
  created_at: string;
};

export type CheckinRow = CheckinLike & {
  id: string;
  plan_week: number;
  criterion_met: boolean | null;
  recommendation: string;
  rule_ids: string[];
  decision: ScheduleDecision;
  created_at: string;
};

export type OpenEnrollment = {
  enrollment: EnrollmentRow;
  plan: PlanRow;
  library: Library;
  checkins: CheckinRow[];
  segments: Segment[];
};

const ENROLLMENT_COLUMNS =
  "id, user_id, content_version, plan_id, start_date, race_date, day_map, status, paused_at, mark_distance_m, mark_time_s, mark_date, created_at";

/**
 * Inscripción vigente (activa o en pausa) con su plan en la versión CONGELADA de la inscripción.
 * Si la versión vigente de la biblioteca es otra, la ficha se lee igual por content_version.
 */
export async function getOpenEnrollment(supabase: SupabaseClient, userId: string): Promise<OpenEnrollment | null> {
  const { data, error } = await supabase
    .from("plan_enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .maybeSingle<EnrollmentRow>();
  if (error) {
    // Sin la migración aplicada la tabla no existe: se trata como "sin inscripción".
    if (error.code !== "42P01" && error.code !== "PGRST205") logError("enrollment:open", error);
    return null;
  }
  if (!data) return null;
  const library = await getLibrary();
  if (!library) return null;
  let plan = library.version.content_version === data.content_version ? findPlan(library, data.plan_id) : null;
  if (!plan) {
    const { data: row } = await supabase
      .from("library_plans")
      .select("*")
      .eq("content_version", data.content_version)
      .eq("id", data.plan_id)
      .maybeSingle<PlanRow>();
    plan = row;
  }
  if (!plan) return null;
  const { data: checkins } = await supabase
    .from("weekly_checkins")
    .select("id, week_start, plan_week, criterion_met, recommendation, rule_ids, decision, next_week_start, next_plan_week, created_at")
    .eq("enrollment_id", data.id)
    .order("week_start")
    .order("created_at");
  const rows = (checkins ?? []) as CheckinRow[];
  return { enrollment: data, plan, library, checkins: rows, segments: segmentsOf(data, rows) };
}
