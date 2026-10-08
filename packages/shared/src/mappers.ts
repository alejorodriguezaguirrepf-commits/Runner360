import {
  entryRequirementsSchema,
  progressionRulesSchema,
  startWeekRuleSchema,
  type PlanVersion,
  type Session,
} from "@runner360/training-engine";
import { z } from "zod";
import type { ExerciseRow, PlanRow, PlanVersionRow, PlanWeekRow, SessionRow, VariantRow } from "./db";

/** Convierte filas de la base en el modelo del motor. Los JSON se validan con Zod (datos no confiables). */
export function toEngineSession(row: SessionRow, exercises: ExerciseRow[] = []): Session {
  return {
    id: row.id,
    weekNumber: row.week_number,
    sessionNumber: row.session_number,
    type: row.session_type,
    title: row.title,
    objective: row.objective,
    distanceM: row.distance_m,
    durationS: row.duration_s,
    intensity: row.intensity,
    rpeMin: row.rpe_min,
    rpeMax: row.rpe_max,
    warmup: row.warmup,
    mainSet: row.main_set,
    cooldown: row.cooldown,
    notes: row.notes,
    progressionCriteria: row.progression_criteria,
    stopCriteria: row.stop_criteria,
    exercises: exercises
      .filter((e) => e.session_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        position: e.position,
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        durationS: e.duration_s,
        restS: e.rest_s,
        notes: e.notes,
      })),
  };
}

export function toEnginePlanVersion(args: {
  plan: PlanRow;
  version: PlanVersionRow;
  weeks?: PlanWeekRow[];
  sessions?: SessionRow[];
  exercises?: ExerciseRow[];
  variants?: VariantRow[];
}): PlanVersion {
  const { plan, version } = args;
  return {
    id: version.id,
    planId: plan.id,
    versionNumber: version.version_number,
    status: version.status,
    isDemo: version.is_demo,
    isPremium: plan.is_premium,
    name: version.name,
    distance: plan.distance,
    level: plan.level,
    durationWeeks: version.duration_weeks,
    sessionsPerWeek: version.sessions_per_week,
    objective: version.objective,
    entryRequirements: entryRequirementsSchema.parse(version.entry_requirements ?? {}),
    progressionRules: progressionRulesSchema.parse(version.progression_rules ?? {}),
    startWeekRules: z.array(startWeekRuleSchema).parse(version.start_week_rules ?? []),
    scheduleVariants: (args.variants ?? []).map((v) => ({
      id: v.id,
      code: v.code,
      label: v.label,
      weekdays: v.weekdays,
      priority: v.priority,
    })),
    weeks: (args.weeks ?? []).map((w) => ({ weekNumber: w.week_number, focus: w.focus, notes: w.notes })),
    sessions: (args.sessions ?? []).map((s) => toEngineSession(s, args.exercises ?? [])),
    validatedBy: version.validated_by,
    validatedAt: version.validated_at,
  };
}
