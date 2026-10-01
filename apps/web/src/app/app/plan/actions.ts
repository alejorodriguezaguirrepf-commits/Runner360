"use server";
import { redirect } from "next/navigation";
import { computeStart, generateCalendar, matchSchedule, selectPlan } from "@runner360/training-engine";
import { getViewer, hasFeature } from "@/lib/auth";
import { loadFullVersion, loadPublishedCatalog } from "@/lib/data/plans";
import { loadRunnerProfile } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";

/**
 * Inicia el plan sugerido. Toda la decisión se recalcula en el servidor con el motor de entrenamiento:
 * el cliente solo indica qué opción aceptó ("recommended" o "introductory").
 */
export async function startPlanAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar?next=/app/plan");
  const choice = fd.get("choice") === "introductory" ? "introductory" : "recommended";
  const supabase = await createClient();

  const profile = await loadRunnerProfile(supabase, viewer.id);
  if (!profile) redirect("/onboarding");
  const catalog = await loadPublishedCatalog(supabase);
  const today = todayKey(viewer.timezone);
  const selection = selectPlan(profile.runner, catalog, today, { premiumPlans: hasFeature(viewer, "premium_plans") });

  let versionId: string;
  let pattern: number[];
  let variantId: string;
  let startDate: string;
  let startWeek: number;
  let raceDate: string | null = null;

  if (choice === "recommended" && selection.kind === "plan") {
    versionId = selection.version.id!;
    pattern = selection.schedule.weekdayPattern;
    variantId = selection.schedule.variantId;
    startDate = selection.startDate;
    startWeek = selection.startWeek;
    raceDate = profile.runner.raceDate;
  } else if (choice === "introductory" && selection.kind === "introductory_recommended" && selection.version && selection.schedule) {
    const start = computeStart(selection.version, today, null);
    if (!start.ok) redirect("/app/plan?error=inicio");
    versionId = selection.version.id!;
    pattern = selection.schedule.weekdayPattern;
    variantId = selection.schedule.variantId;
    startDate = start.startDate;
    startWeek = start.startWeek;
  } else {
    redirect("/app/plan?error=seleccion");
  }

  const full = await loadFullVersion(supabase, versionId);
  if (!full || full.weeks.length === 0) redirect("/app/plan?error=acceso");
  // Revalidar el patrón contra la versión completa (defensa en profundidad).
  if (!matchSchedule(full.scheduleVariants, pattern)) redirect("/app/plan?error=seleccion");

  const entries = generateCalendar({ version: full, startDate, startWeek, weekdayPattern: pattern });
  if (entries.some((e) => !e.sessionId)) redirect("/app/plan?error=datos");

  const { error } = await supabase.rpc("start_training_plan", {
    p_plan_version_id: versionId,
    p_start_date: startDate,
    p_start_week: startWeek,
    p_schedule_variant_id: variantId,
    p_weekday_pattern: pattern,
    p_race_date: raceDate,
    p_entries: entries.map((e) => ({ sessionId: e.sessionId, weekNumber: e.weekNumber, scheduledDate: e.scheduledDate })),
  });
  if (error) {
    console.error("[plan.start] db_error", error.code);
    redirect("/app/plan?error=guardar");
  }
  redirect("/app/plan?iniciado=1");
}

export async function abandonPlanAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");
  const id = String(fd.get("userPlanId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_training_plans")
    .update({ status: "abandoned", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", viewer.id)
    .eq("status", "active");
  if (error) console.error("[plan.abandon] db_error", error.code);
  redirect("/app/plan");
}
