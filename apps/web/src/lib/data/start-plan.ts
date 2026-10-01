import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeStart, generateCalendar, matchSchedule, selectPlan } from "@runner360/training-engine";
import { loadFullVersion, loadPublishedCatalog } from "./plans";
import { loadRunnerProfile } from "./training";
import { todayKey } from "@/lib/today";

export type StartPlanResult =
  | { ok: true; userPlanId: string }
  | { ok: false; error: "perfil" | "seleccion" | "acceso" | "datos" | "inicio" | "guardar" };

/**
 * Inicio de plan compartido por la web (server action) y la app móvil (API con Bearer).
 * Toda la decisión se recalcula en el servidor con el motor; el cliente solo elige la opción.
 */
export async function startPlanForUser(
  supabase: SupabaseClient,
  user: { id: string; timezone: string; premiumPlans: boolean },
  choice: "recommended" | "introductory",
): Promise<StartPlanResult> {
  const profile = await loadRunnerProfile(supabase, user.id);
  if (!profile) return { ok: false, error: "perfil" };
  const catalog = await loadPublishedCatalog(supabase);
  const today = todayKey(user.timezone);
  const selection = selectPlan(profile.runner, catalog, today, { premiumPlans: user.premiumPlans });

  let pick: { versionId: string; pattern: number[]; variantId: string; startDate: string; startWeek: number; raceDate: string | null };
  if (choice === "recommended" && selection.kind === "plan") {
    pick = {
      versionId: selection.version.id!, pattern: selection.schedule.weekdayPattern, variantId: selection.schedule.variantId,
      startDate: selection.startDate, startWeek: selection.startWeek, raceDate: profile.runner.raceDate,
    };
  } else if (choice === "introductory" && selection.kind === "introductory_recommended" && selection.version && selection.schedule) {
    const start = computeStart(selection.version, today, null);
    if (!start.ok) return { ok: false, error: "inicio" };
    pick = {
      versionId: selection.version.id!, pattern: selection.schedule.weekdayPattern, variantId: selection.schedule.variantId,
      startDate: start.startDate, startWeek: start.startWeek, raceDate: null,
    };
  } else {
    return { ok: false, error: "seleccion" };
  }

  const full = await loadFullVersion(supabase, pick.versionId);
  if (!full || full.weeks.length === 0) return { ok: false, error: "acceso" };
  if (!matchSchedule(full.scheduleVariants, pick.pattern)) return { ok: false, error: "seleccion" };
  const entries = generateCalendar({ version: full, startDate: pick.startDate, startWeek: pick.startWeek, weekdayPattern: pick.pattern });
  if (entries.some((e) => !e.sessionId)) return { ok: false, error: "datos" };

  const { data, error } = await supabase.rpc("start_training_plan", {
    p_plan_version_id: pick.versionId,
    p_start_date: pick.startDate,
    p_start_week: pick.startWeek,
    p_schedule_variant_id: pick.variantId,
    p_weekday_pattern: pick.pattern,
    p_race_date: pick.raceDate,
    p_entries: entries.map((e) => ({ sessionId: e.sessionId, weekNumber: e.weekNumber, scheduledDate: e.scheduledDate })),
  });
  if (error) {
    console.error("[plan.start] db_error", error.code);
    return { ok: false, error: "guardar" };
  }
  return { ok: true, userPlanId: data as string };
}
