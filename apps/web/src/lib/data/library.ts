import "server-only";
import type { CatalogPlan, Category, Intensity, LoadSignal, SessionCategory } from "@runner360/plan-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { logError } from "@/lib/log";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Lectura de la Biblioteca de planes.
 * - Fichas, semanas (totales) y textos globales son contenido público y versionado: se cachean.
 * - El detalle día por día depende del acceso de la persona (semanas gratis / Premium): se lee
 *   con su sesión, sin caché compartida.
 * Si la biblioteca no está instalada todavía, las funciones devuelven null (y no se cachea).
 */

export type LibraryVersion = {
  content_version: string;
  model_runner_assumptions: { note: string } & Record<string, unknown>;
  category_legend: Record<Category, string>;
  zone_map: Record<string, string>;
  load_monitoring: LoadSignal[];
  practical_rules: string[];
  safety: string[];
  individual_adaptation: { situation: string; adaptation: string }[];
  glossary: { term: string; definition: string }[];
};

export type PlanRow = CatalogPlan & { content_version: string };

export type WeekRow = {
  week: number;
  phase: string;
  week_type: string;
  week_type_label: string;
  weekly_goal: string;
  progression_criterion: string;
  distance_km_est: number;
  duration_min_est: number;
  running_sessions: number;
  strength_sessions: number;
  zone_pct: { Z1: number; Z2: number; Z3: number };
  includes_race: boolean;
};

export type DayRow = {
  week: number;
  day_index: number;
  day_label: string;
  is_rest: boolean;
  strength_only: boolean;
  code: string | null;
  session_type: string | null;
  category: SessionCategory | null;
  short_label: string | null;
  physiological_goal: string | null;
  warmup: string | null;
  main_set: string | null;
  cooldown: string | null;
  duration_min_est: number | null;
  distance_km_est: number | null;
  intensity: string | null;
  technical_notes: string | null;
  strength_after: boolean | null;
  is_quality: boolean | null;
  minutes_by_intensity: Record<string, number> | null;
};

export type OverviewDay = Pick<DayRow, "week" | "day_index" | "is_rest" | "strength_only" | "category" | "short_label" | "is_quality">;

export type Library = {
  version: LibraryVersion;
  plans: PlanRow[];
  intensities: (Intensity & { position: number })[];
  strength: { routine: "A" | "B" | "C"; position: number; exercise: string; target: string; sets_reps: string }[];
  freePreviewWeeks: number;
};

const PLAN_COLUMNS =
  "content_version, id, number, chapter, distance_label, distance_km, level, duration_label, duration_weeks, days_per_week, race_week, title, runner_profile, entry_requirements, min_weekly_km, main_goal, secondary_goals, strength_routine, weekly_template, phases, notes, validation";

class LibraryUnavailable extends Error {}

function must<T>(res: { data: T | null; error: unknown }, what: string): T {
  if (res.error || res.data === null) throw new LibraryUnavailable(`${what}: ${JSON.stringify(res.error)}`);
  return res.data;
}

const loadLibrary = unstable_cache(
  async (): Promise<Library> => {
    const db = createPublicClient();
    if (!db) throw new LibraryUnavailable("sin configuración");
    const version = must(
      await db
        .from("library_versions")
        .select("content_version, model_runner_assumptions, category_legend, zone_map, load_monitoring, practical_rules, safety, individual_adaptation, glossary")
        .eq("is_current", true)
        .maybeSingle<LibraryVersion>(),
      "versión vigente",
    );
    const v = version.content_version;
    const [plans, intensities, strength, settings] = await Promise.all([
      db.from("library_plans").select(PLAN_COLUMNS).eq("content_version", v).order("number"),
      db.from("library_intensities").select("position, name, zone, rpe, talk_test, feel, use_for").eq("content_version", v).order("position"),
      db.from("library_strength_exercises").select("routine, position, exercise, target, sets_reps").eq("content_version", v).order("routine").order("position"),
      db.from("library_settings").select("free_preview_weeks").maybeSingle<{ free_preview_weeks: number }>(),
    ]);
    return {
      version,
      plans: must(plans, "planes") as unknown as PlanRow[],
      intensities: (must(intensities, "intensidades") as { position: number; name: string; zone: string; rpe: string; talk_test: string; feel: string; use_for: string }[]).map(
        ({ use_for, ...i }) => ({ ...i, use: use_for }),
      ),
      strength: must(strength, "fuerza") as Library["strength"],
      freePreviewWeeks: settings.data?.free_preview_weeks ?? 0,
    };
  },
  ["library-current"],
  { revalidate: 600, tags: ["library"] },
);

/** Biblioteca vigente (fichas y textos globales), o null si no está disponible. */
export async function getLibrary(): Promise<Library | null> {
  try {
    return await loadLibrary();
  } catch (e) {
    logError("library:load", e);
    return null;
  }
}

const loadWeeks = unstable_cache(
  async (version: string, planId: string): Promise<WeekRow[]> => {
    const db = createPublicClient();
    if (!db) throw new LibraryUnavailable("sin configuración");
    return must(
      await db
        .from("library_weeks")
        .select("week, phase, week_type, week_type_label, weekly_goal, progression_criterion, distance_km_est, duration_min_est, running_sessions, strength_sessions, zone_pct, includes_race")
        .eq("content_version", version)
        .eq("plan_id", planId)
        .order("week"),
      "semanas",
    ) as WeekRow[];
  },
  ["library-weeks"],
  { revalidate: 86_400, tags: ["library"] },
);

/** Semanas (sin días) de un plan: contenido público e inmutable por versión. */
export async function getPlanWeeks(version: string, planId: string): Promise<WeekRow[] | null> {
  try {
    return await loadWeeks(version, planId);
  } catch (e) {
    logError("library:weeks", e);
    return null;
  }
}

/** Grilla liviana (categoría y etiqueta) de las semanas que la persona puede ver. */
export async function getOverviewDays(supabase: SupabaseClient, version: string, planId: string): Promise<OverviewDay[]> {
  const { data, error } = await supabase
    .from("library_days")
    .select("week, day_index, is_rest, strength_only, category, short_label, is_quality")
    .eq("content_version", version)
    .eq("plan_id", planId)
    .order("week")
    .order("day_index");
  if (error) logError("library:overview", error);
  return (data ?? []) as OverviewDay[];
}

/** Los 7 días completos de una semana, o [] si la persona no tiene acceso a esa semana. */
export async function getWeekDays(supabase: SupabaseClient, version: string, planId: string, week: number): Promise<DayRow[]> {
  const { data, error } = await supabase
    .from("library_days")
    .select(
      "week, day_index, day_label, is_rest, strength_only, code, session_type, category, short_label, physiological_goal, warmup, main_set, cooldown, duration_min_est, distance_km_est, intensity, technical_notes, strength_after, is_quality, minutes_by_intensity",
    )
    .eq("content_version", version)
    .eq("plan_id", planId)
    .eq("week", week)
    .order("day_index");
  if (error) logError("library:week", error);
  return (data ?? []) as DayRow[];
}

export function findPlan(library: Library, id: string): PlanRow | null {
  return library.plans.find((p) => p.id === id) ?? null;
}
