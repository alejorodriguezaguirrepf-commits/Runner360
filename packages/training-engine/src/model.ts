import { z } from "zod";
import { INTENSITIES, RACE_DISTANCES, RUNNER_LEVELS, SESSION_TYPES } from "@runner360/shared";

/**
 * Modelo de planes de entrenamiento. Independiente de React, Flutter y Supabase.
 * Un plan (training_plans) tiene versiones inmutables una vez publicadas
 * (training_plan_versions); cada versión contiene semanas y sesiones.
 */

export const PLAN_STATUSES = ["draft", "in_review", "approved", "published", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const VALIDATION_STATUSES = ["demo_unvalidated", "pending_review", "validated"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const exerciseSchema = z.object({
  order: z.number().int().min(1),
  name: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(50).nullable(),
  reps: z.number().int().min(1).max(500).nullable(),
  durationS: z.number().int().min(1).max(36_000).nullable(),
  distanceM: z.number().int().min(1).max(100_000).nullable(),
  restS: z.number().int().min(0).max(3600).nullable(),
  notes: z.string().max(500).nullable(),
});
export type PlanExercise = z.infer<typeof exerciseSchema>;

export const planSessionSchema = z.object({
  id: z.string().optional(),
  sessionNumber: z.number().int().min(1),
  /** Posición ordinal dentro de la semana (1..sessionsPerWeek). La variante de calendario la traduce a un día real. */
  daySlot: z.number().int().min(1).max(7),
  type: z.enum(SESSION_TYPES),
  title: z.string().min(1).max(120),
  objective: z.string().max(500),
  distanceM: z.number().int().min(1).max(100_000).nullable(),
  durationS: z.number().int().min(1).max(36_000).nullable(),
  intensity: z.enum(INTENSITIES),
  rpeMin: z.number().int().min(1).max(10).nullable(),
  rpeMax: z.number().int().min(1).max(10).nullable(),
  warmup: z.string().max(1000),
  mainSet: z.string().max(2000),
  cooldown: z.string().max(1000),
  notes: z.string().max(1000),
  exercises: z.array(exerciseSchema).default([]),
});
export type PlanSession = z.infer<typeof planSessionSchema>;

export const planWeekSchema = z.object({
  id: z.string().optional(),
  weekNumber: z.number().int().min(1),
  focus: z.string().max(200),
  notes: z.string().max(1000),
  sessions: z.array(planSessionSchema),
});
export type PlanWeek = z.infer<typeof planWeekSchema>;

export const scheduleVariantSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().max(80),
  /** Patrones de días ISO (1=lunes) validados profesionalmente. Cada patrón tiene sessionsPerWeek elementos. */
  weekdayPatterns: z.array(z.array(z.number().int().min(1).max(7))).min(1),
});
export type ScheduleVariant = z.infer<typeof scheduleVariantSchema>;

export const entryRequirementsSchema = z.object({
  minWeeklyDistanceM: z.number().int().min(0),
  minExperienceMonths: z.number().int().min(0),
  /** Si es true, un antecedente de lesión reciente o condición médica deriva a revisión profesional. */
  requiresHealthClearance: z.boolean().default(true),
  notes: z.string().max(1000).default(""),
});
export type EntryRequirements = z.infer<typeof entryRequirementsSchema>;

export const progressionRulesSchema = z.object({
  /** Cumplimiento mínimo de la semana (0..1) para sugerir avanzar normalmente. */
  minWeeklyCompliance: z.number().min(0).max(1).default(0.7),
  /** RPE reportado que, al superar el máximo planificado por este margen, genera alerta. */
  rpeOverTargetMargin: z.number().int().min(0).max(5).default(2),
  /** Cantidad de sesiones con RPE excedido en la semana para sugerir revisión. */
  rpeOverTargetSessions: z.number().int().min(1).max(7).default(2),
  /** Aumento máximo de carga semanal planificada (en duración) que no genera advertencia al validar. */
  maxWeeklyLoadIncreasePct: z.number().min(0).max(100).default(10),
  /** Semanas iniciales que pueden omitirse si la competencia está cerca. 0 = nunca. */
  maxSkippableWeeks: z.number().int().min(0).max(8).default(0),
});
export type ProgressionRules = z.infer<typeof progressionRulesSchema>;

export const planVersionSchema = z.object({
  id: z.string().optional(),
  planId: z.string().optional(),
  version: z.number().int().min(1),
  name: z.string().min(3).max(120),
  kind: z.enum(["standard", "introductory"]),
  targetDistance: z.enum(RACE_DISTANCES),
  level: z.enum(RUNNER_LEVELS),
  durationWeeks: z.number().int().min(1).max(52),
  sessionsPerWeek: z.number().int().min(1).max(7),
  objective: z.string().max(2000),
  entryRequirements: entryRequirementsSchema,
  progressionCriteria: z.string().max(2000),
  reduceOrStopCriteria: z.string().max(2000),
  progressionRules: progressionRulesSchema,
  scheduleVariants: z.array(scheduleVariantSchema),
  isDemo: z.boolean(),
  validationStatus: z.enum(VALIDATION_STATUSES),
  status: z.enum(PLAN_STATUSES),
  requiresPremium: z.boolean(),
  approvedAt: z.string().nullable().default(null),
  weeks: z.array(planWeekSchema),
});
export type PlanVersion = z.infer<typeof planVersionSchema>;

/** Rangos de referencia de duración (semanas). Configurables por el administrador al crear el plan. */
export const DURATION_LIMITS = {
  standard: { min: 8, max: 24 },
  introductory: { min: 4, max: 24 },
} as const;
