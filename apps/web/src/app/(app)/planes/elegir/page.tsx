import { formatClock } from "@runner360/plan-library";
import type { Metadata } from "next";
import { EstimateNotice, SafetyNotices } from "@/components/library/notices";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { requireOnboardedSession } from "@/lib/auth";
import { findPlan, getLibrary } from "@/lib/data/library";
import { AssistantForm, type AssistantDefaults } from "./assistant-form";

export const metadata: Metadata = { title: "¿Cuál es mi plan?" };

const m = t.library;

/** Distancia del perfil de corredor (onboarding) → distancia de la biblioteca. */
const PROFILE_DISTANCE: Record<string, number> = { "5K": 5, "10K": 10, "21K": 21.0975, "42K": 42.195 };
const PROFILE_MONTHS: Record<string, string> = { none: "0", lt_6m: "3", "6_12m": "9", "1_3y": "24", gt_3y: "48" };

type TrainingProfile = {
  target_distance: string;
  experience: string;
  weekly_km: number;
  available_weekdays: number[];
  recent_mark_distance_m: number | null;
  recent_mark_time_s: number | null;
  recent_mark_date: string | null;
  race_date: string | null;
};

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { supabase, user } = await requireOnboardedSession();
  const library = await getLibrary();
  if (!library) {
    return (
      <>
        <PageHeader title={m.assistant.title} />
        <Alert tone="info" title={m.unavailable.title}>{m.unavailable.text}</Alert>
      </>
    );
  }
  const { plan: planParam } = await searchParams;
  const focus = planParam ? findPlan(library, planParam) : null;

  const { data: tp } = await supabase
    .from("training_profiles")
    .select("target_distance, experience, weekly_km, available_weekdays, recent_mark_distance_m, recent_mark_time_s, recent_mark_date, race_date")
    .eq("user_id", user.id)
    .maybeSingle<TrainingProfile>();

  const distances = [...new Map(library.plans.map((p) => [p.distance_km, p.distance_label])).entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, label]) => ({ value: String(value), label }));
  const markKm = tp?.recent_mark_distance_m ? tp.recent_mark_distance_m / 1000 : null;
  const defaults: AssistantDefaults = {
    distanceKm: String(focus?.distance_km ?? (tp ? (PROFILE_DISTANCE[tp.target_distance] ?? "") : "")),
    runningMonths: tp ? (PROFILE_MONTHS[tp.experience] ?? "0") : "0",
    weeklyKm: tp ? String(tp.weekly_km).replace(".", ",") : "0",
    currentDays: "0",
    daysAvailable: tp ? String(tp.available_weekdays.length) : "3",
    // Solo se precarga la marca si coincide con una distancia de la lista.
    markDistanceKm: markKm && [5, 10, 21.1, 42.195].some((d) => Math.abs(d - markKm) < 0.2) ? String([5, 10, 21.1, 42.195].find((d) => Math.abs(d - markKm) < 0.2)) : "",
    markTime: tp?.recent_mark_time_s ? formatClock(tp.recent_mark_time_s) : "",
    markDate: tp?.recent_mark_date ?? "",
    raceDate: tp?.race_date ?? "",
  };

  return (
    <>
      <PageHeader title={m.assistant.title} subtitle={focus ? fmt(m.assistant.forPlan, { n: focus.number, title: focus.title }) : m.assistant.subtitle} />
      <div className="mb-6 space-y-3">
        <EstimateNotice note={library.version.model_runner_assumptions.note} />
        <SafetyNotices items={library.version.safety} />
      </div>
      <AssistantForm defaults={defaults} distances={distances} focusPlanId={focus?.id ?? null} prefilled={Boolean(tp)} />
    </>
  );
}
