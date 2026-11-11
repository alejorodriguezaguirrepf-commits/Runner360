import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinishedSession } from "@/components/training/finish-session";
import type { Split } from "@/lib/session-finish";
import type { WellnessRow } from "@/lib/wellness";

const WELLNESS_COLUMNS = "check_date, sleep, energy, soreness, stress, mood, score, note";

export async function getWellness(supabase: SupabaseClient, userId: string, date: string): Promise<WellnessRow | null> {
  const { data } = await supabase.from("wellness_checkins").select(WELLNESS_COLUMNS).eq("user_id", userId).eq("check_date", date).maybeSingle<WellnessRow>();
  return data ?? null;
}

export async function hasHealthConsent(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_consent", { p_user: userId, p_type: "health_data" });
  return data === true;
}

/** Sesión del plan de un día con sus parciales (para "Finalizar sesión"). */
export async function getFinishedSession(supabase: SupabaseClient, enrollmentId: string, date: string): Promise<FinishedSession | null> {
  const { data: log } = await supabase
    .from("workout_logs")
    .select("id, status, distance_m, duration_s, rpe")
    .eq("enrollment_id", enrollmentId)
    .eq("workout_date", date)
    .maybeSingle<{ id: string; status: string; distance_m: number | null; duration_s: number | null; rpe: number | null }>();
  if (!log || log.status === "skipped") return null;
  const { data: splits } = await supabase.from("workout_splits").select("distance_m, duration_s").eq("workout_id", log.id).order("split_index");
  return {
    distanceM: log.distance_m,
    durationS: log.duration_s,
    rpe: log.rpe,
    splits: ((splits ?? []) as { distance_m: number; duration_s: number }[]).map((s) => ({ meters: s.distance_m, seconds: s.duration_s })),
  };
}

export type MonitoredSession = {
  id: string;
  workout_date: string;
  status: "completed" | "modified" | "skipped";
  distance_m: number | null;
  duration_s: number | null;
  rpe: number | null;
  comments: string | null;
  plan_week: number | null;
  splits: Split[];
};

/** Wellness y sesiones (con parciales) de una persona desde una fecha. Lo usan la persona y el equipo (RLS). */
export async function loadMonitoring(supabase: SupabaseClient, userId: string, from: string): Promise<{ wellness: WellnessRow[]; sessions: MonitoredSession[] }> {
  const [{ data: wellness }, { data: logs }] = await Promise.all([
    supabase.from("wellness_checkins").select(WELLNESS_COLUMNS).eq("user_id", userId).gte("check_date", from).order("check_date"),
    supabase
      .from("workout_logs")
      .select("id, workout_date, status, distance_m, duration_s, rpe, comments, plan_week")
      .eq("user_id", userId)
      .gte("workout_date", from)
      .neq("status", "skipped")
      .order("workout_date", { ascending: false }),
  ]);
  const rows = (logs ?? []) as Omit<MonitoredSession, "splits">[];
  const ids = rows.map((r) => r.id);
  const { data: splits } = ids.length
    ? await supabase.from("workout_splits").select("workout_id, split_index, distance_m, duration_s").in("workout_id", ids).order("split_index")
    : { data: [] };
  const byWorkout = new Map<string, Split[]>();
  for (const s of (splits ?? []) as { workout_id: string; distance_m: number; duration_s: number }[]) {
    byWorkout.set(s.workout_id, [...(byWorkout.get(s.workout_id) ?? []), { meters: s.distance_m, seconds: s.duration_s }]);
  }
  return { wellness: (wellness ?? []) as WellnessRow[], sessions: rows.map((r) => ({ ...r, splits: byWorkout.get(r.id) ?? [] })) };
}
