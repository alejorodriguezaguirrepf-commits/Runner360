import "server-only";
import { daysBetween, MARK_MAX_AGE_WEEKS, modelSpeeds, runnerSpeeds, type Speeds } from "@runner360/plan-library";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Velocidades para mostrar la parte principal en km y de dónde salen. */
export type PlanPaces = { speeds: Speeds | null; testDate: string | null };

/**
 * Ritmo de referencia del corredor para un plan: su último test de la calculadora si es de las
 * últimas 8 semanas; si no, el corredor modelo del capítulo (nivel del plan).
 */
export async function planPaces(
  supabase: SupabaseClient,
  userId: string,
  assumptions: Record<string, unknown>,
  chapter: number,
  today: string,
): Promise<PlanPaces> {
  const model = modelSpeeds(assumptions, chapter);
  if (!model) return { speeds: null, testDate: null };
  const { data } = await supabase
    .from("user_pace_tests")
    .select("distance_m, time_s, updated_at")
    .eq("user_id", userId)
    .maybeSingle<{ distance_m: number; time_s: number; updated_at: string }>();
  const date = data?.updated_at.slice(0, 10) ?? null;
  const recent = date !== null && daysBetween(date, today) <= MARK_MAX_AGE_WEEKS * 7;
  if (!data || !recent) return { speeds: model, testDate: null };
  return { speeds: runnerSpeeds(model, { distanceKm: data.distance_m / 1000, timeS: data.time_s }), testDate: date };
}
