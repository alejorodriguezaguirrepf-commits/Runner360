import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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

/** Tiempos de los parciales (en orden) de cada registro. */
export async function getSplitSeconds(supabase: SupabaseClient, workoutIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!workoutIds.length) return out;
  const { data } = await supabase.from("workout_splits").select("workout_id, split_index, duration_s").in("workout_id", workoutIds).order("split_index");
  for (const s of (data ?? []) as { workout_id: string; duration_s: number }[]) out.set(s.workout_id, [...(out.get(s.workout_id) ?? []), s.duration_s]);
  return out;
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
