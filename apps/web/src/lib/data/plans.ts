import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryRequirementsSchema,
  progressionRulesSchema,
  scheduleVariantSchema,
  type PlanVersion,
  type PlanSession,
} from "@runner360/training-engine";
import { z } from "zod";

/** Filas de la base → modelo del motor. Se valida con Zod para no confiar en JSON arbitrario. */
export const VERSION_COLUMNS =
  "id, plan_id, version, name, status, validation_status, duration_weeks, sessions_per_week, objective, entry_requirements, progression_criteria, reduce_or_stop_criteria, progression_rules, schedule_variants, requires_premium, approved_at, reviewer_notes, published_at, created_at, training_plans!inner(id, slug, kind, target_distance, level, is_demo)";

export const SESSION_COLUMNS =
  "id, week_id, session_number, day_slot, session_type, title, objective, distance_m, duration_s, intensity, rpe_min, rpe_max, warmup, main_set, cooldown, notes";

export type VersionRow = {
  id: string;
  plan_id: string;
  version: number;
  name: string;
  status: PlanVersion["status"];
  validation_status: PlanVersion["validationStatus"];
  duration_weeks: number;
  sessions_per_week: number;
  objective: string;
  entry_requirements: unknown;
  progression_criteria: string;
  reduce_or_stop_criteria: string;
  progression_rules: unknown;
  schedule_variants: unknown;
  requires_premium: boolean;
  approved_at: string | null;
  reviewer_notes: string | null;
  published_at: string | null;
  created_at: string;
  training_plans: { id: string; slug: string; kind: PlanVersion["kind"]; target_distance: PlanVersion["targetDistance"]; level: PlanVersion["level"]; is_demo: boolean };
};

export type SessionRow = {
  id: string;
  week_id: string;
  session_number: number;
  day_slot: number;
  session_type: PlanSession["type"];
  title: string;
  objective: string;
  distance_m: number | null;
  duration_s: number | null;
  intensity: PlanSession["intensity"];
  rpe_min: number | null;
  rpe_max: number | null;
  warmup: string;
  main_set: string;
  cooldown: string;
  notes: string;
};

export type WeekRow = { id: string; week_number: number; focus: string; notes: string; training_sessions: SessionRow[] };

export function sessionFromRow(s: SessionRow): PlanSession {
  return {
    id: s.id,
    sessionNumber: s.session_number,
    daySlot: s.day_slot,
    type: s.session_type,
    title: s.title,
    objective: s.objective,
    distanceM: s.distance_m,
    durationS: s.duration_s,
    intensity: s.intensity,
    rpeMin: s.rpe_min,
    rpeMax: s.rpe_max,
    warmup: s.warmup,
    mainSet: s.main_set,
    cooldown: s.cooldown,
    notes: s.notes,
    exercises: [],
  };
}

export function versionFromRow(v: VersionRow, weeks: WeekRow[] = []): PlanVersion {
  return {
    id: v.id,
    planId: v.plan_id,
    version: v.version,
    name: v.name,
    kind: v.training_plans.kind,
    targetDistance: v.training_plans.target_distance,
    level: v.training_plans.level,
    durationWeeks: v.duration_weeks,
    sessionsPerWeek: v.sessions_per_week,
    objective: v.objective,
    entryRequirements: entryRequirementsSchema.parse(v.entry_requirements ?? {}),
    progressionCriteria: v.progression_criteria,
    reduceOrStopCriteria: v.reduce_or_stop_criteria,
    progressionRules: progressionRulesSchema.parse(v.progression_rules ?? {}),
    scheduleVariants: z.array(scheduleVariantSchema).parse(v.schedule_variants ?? []),
    isDemo: v.training_plans.is_demo,
    validationStatus: v.validation_status,
    status: v.status,
    requiresPremium: v.requires_premium,
    approvedAt: v.approved_at,
    weeks: weeks
      .map((w) => ({
        id: w.id,
        weekNumber: w.week_number,
        focus: w.focus,
        notes: w.notes,
        sessions: (w.training_sessions ?? []).map(sessionFromRow).sort((a, b) => a.sessionNumber - b.sessionNumber),
      }))
      .sort((a, b) => a.weekNumber - b.weekNumber),
  };
}

/** Catálogo publicado (solo metadatos, sin semanas). */
export async function loadPublishedCatalog(sb: SupabaseClient): Promise<PlanVersion[]> {
  const { data, error } = await sb.from("training_plan_versions").select(VERSION_COLUMNS).eq("status", "published");
  if (error) throw new Error(`catalog:${error.code}`);
  return ((data ?? []) as unknown as VersionRow[]).map((r) => versionFromRow(r));
}

/** Versión completa con semanas y sesiones (respeta RLS: Premium/asignación). */
export async function loadFullVersion(sb: SupabaseClient, versionId: string): Promise<PlanVersion | null> {
  const [{ data: v }, { data: weeks }] = await Promise.all([
    sb.from("training_plan_versions").select(VERSION_COLUMNS).eq("id", versionId).maybeSingle(),
    sb.from("training_plan_weeks").select(`id, week_number, focus, notes, training_sessions(${SESSION_COLUMNS})`).eq("plan_version_id", versionId),
  ]);
  if (!v) return null;
  return versionFromRow(v as unknown as VersionRow, (weeks ?? []) as unknown as WeekRow[]);
}
