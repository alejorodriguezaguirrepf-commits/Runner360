import { z } from "zod";

/**
 * Modelos de dominio del motor de entrenamiento.
 *
 * Convenciones de unidades (sin floats sin control):
 *  - Distancias en METROS (enteros).
 *  - Duraciones en SEGUNDOS (enteros).
 *  - Fechas de calendario como strings ISO `YYYY-MM-DD` (sin zona horaria).
 *  - Días de la semana ISO: 1 = lunes ... 7 = domingo.
 */

export const DISTANCE_CODES = ["5K", "10K", "15K", "21K", "42K"] as const;
export const distanceCodeSchema = z.enum(DISTANCE_CODES);
export type DistanceCode = z.infer<typeof distanceCodeSchema>;

/** Distancia oficial de cada objetivo, en metros. 21K y 42K usan las distancias reglamentarias. */
export const DISTANCE_METERS: Record<DistanceCode, number> = {
  "5K": 5000,
  "10K": 10000,
  "15K": 15000,
  "21K": 21097.5,
  "42K": 42195,
};

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const SESSION_TYPES = [
  "easy_run",
  "long_run",
  "intervals",
  "tempo",
  "recovery",
  "rest",
  "strength",
  "test",
] as const;
export const sessionTypeSchema = z.enum(SESSION_TYPES);
export type SessionType = z.infer<typeof sessionTypeSchema>;

export const INTENSITIES = ["very_low", "low", "moderate", "high", "very_high"] as const;
export const intensitySchema = z.enum(INTENSITIES);
export type Intensity = z.infer<typeof intensitySchema>;

export const EXPERIENCE_LEVELS = ["none", "lt_6m", "6_12m", "1_3y", "gt_3y"] as const;
export const experienceSchema = z.enum(EXPERIENCE_LEVELS);
export type Experience = z.infer<typeof experienceSchema>;

/** Cota inferior (en meses) de cada rango de experiencia. Se usa para requisitos de ingreso. */
export const EXPERIENCE_MIN_MONTHS: Record<Experience, number> = {
  none: 0,
  lt_6m: 1,
  "6_12m": 6,
  "1_3y": 12,
  gt_3y: 36,
};

export const GOALS = ["complete", "improve", "race"] as const;
export const goalSchema = z.enum(GOALS);
export type Goal = z.infer<typeof goalSchema>;

/**
 * Antecedentes que el usuario puede declarar voluntariamente (dato sensible, requiere consentimiento).
 * No se usan para diagnosticar: cualquier marca deriva a revisión profesional.
 */
export const HEALTH_FLAGS = [
  "medical_restriction",
  "cardiovascular_or_respiratory_condition",
  "chest_pain_or_fainting",
  "recent_injury",
  "pregnancy_or_postpartum",
  "other",
] as const;
export const healthFlagSchema = z.enum(HEALTH_FLAGS);
export type HealthFlag = z.infer<typeof healthFlagSchema>;

export const PLAN_VERSION_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export const planVersionStatusSchema = z.enum(PLAN_VERSION_STATUSES);
export type PlanVersionStatus = z.infer<typeof planVersionStatusSchema>;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (formato AAAA-MM-DD)")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Fecha inexistente");

export const weekdaySchema = z.number().int().min(1).max(7);

export const weekdayListSchema = z
  .array(weekdaySchema)
  .min(1, "Elegí al menos un día")
  .max(7)
  .refine((days) => new Set(days).size === days.length, "Días repetidos");

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export const exerciseSchema = z.object({
  position: z.number().int().min(1),
  name: z.string().trim().min(1).max(120),
  sets: z.number().int().min(1).max(20).nullable().default(null),
  reps: z.number().int().min(1).max(200).nullable().default(null),
  durationS: z.number().int().min(1).max(3600).nullable().default(null),
  restS: z.number().int().min(0).max(1800).nullable().default(null),
  notes: z.string().max(500).default(""),
});
export type Exercise = z.infer<typeof exerciseSchema>;

export const sessionSchema = z
  .object({
    id: z.string().optional(),
    weekNumber: z.number().int().min(1).max(24),
    sessionNumber: z.number().int().min(1).max(7),
    type: sessionTypeSchema,
    title: z.string().trim().min(1).max(120),
    objective: z.string().max(500).default(""),
    distanceM: z.number().int().positive().max(100000).nullable().default(null),
    durationS: z.number().int().positive().max(6 * 3600).nullable().default(null),
    intensity: intensitySchema,
    rpeMin: z.number().int().min(1).max(10).nullable().default(null),
    rpeMax: z.number().int().min(1).max(10).nullable().default(null),
    warmup: z.string().max(1000).default(""),
    mainSet: z.string().max(2000).default(""),
    cooldown: z.string().max(1000).default(""),
    notes: z.string().max(2000).default(""),
    progressionCriteria: z.string().max(1000).default(""),
    stopCriteria: z.string().max(1000).default(""),
    exercises: z.array(exerciseSchema).default([]),
  })
  .refine((s) => s.type === "rest" || s.distanceM !== null || s.durationS !== null, {
    message: "Las sesiones activas requieren distancia o duración",
    path: ["durationS"],
  })
  .refine((s) => s.rpeMin === null || s.rpeMax === null || s.rpeMin <= s.rpeMax, {
    message: "RPE mínimo mayor que el máximo",
    path: ["rpeMin"],
  });
export type Session = z.infer<typeof sessionSchema>;

export const weekSchema = z.object({
  weekNumber: z.number().int().min(1).max(24),
  focus: z.string().max(200).default(""),
  notes: z.string().max(1000).default(""),
});
export type Week = z.infer<typeof weekSchema>;

export const scheduleVariantSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  /** weekdays[i] = día ISO asignado a la sesión número i+1. */
  weekdays: weekdayListSchema,
  priority: z.number().int().min(0).default(0),
});
export type ScheduleVariant = z.infer<typeof scheduleVariantSchema>;

export const entryRequirementsSchema = z.object({
  minWeeklyKm: z.number().min(0).max(300).default(0),
  minExperienceMonths: z.number().int().min(0).max(600).default(0),
  minAge: z.number().int().min(13).max(100).default(18),
  notes: z.string().max(1000).default(""),
});
export type EntryRequirements = z.infer<typeof entryRequirementsSchema>;

export const startWeekRuleSchema = z.object({
  minWeeklyKm: z.number().min(0).max(300),
  startWeek: z.number().int().min(1).max(24),
});
export type StartWeekRule = z.infer<typeof startWeekRuleSchema>;

export const progressionRulesSchema = z
  .object({
    /** Cumplimiento semanal mínimo (0–1) para avanzar normalmente. */
    minComplianceToAdvance: z.number().min(0).max(1).default(0.6),
    /** Por debajo de este cumplimiento se sugiere repetir la semana. */
    repeatWeekBelowCompliance: z.number().min(0).max(1).default(0.4),
    /** RPE medio registrado por encima del cual se sugiere revisión. */
    reviewAboveAvgRpe: z.number().min(1).max(10).default(8.5),
    /** Si el usuario reporta dolor, siempre se sugiere revisión profesional. */
    reviewOnPainReport: z.boolean().default(true),
    /** Aumento máximo de volumen semanal planificado (validación de publicación). */
    maxWeeklyVolumeIncreasePct: z.number().min(0).max(100).default(15),
  })
  .refine((r) => r.repeatWeekBelowCompliance <= r.minComplianceToAdvance, {
    message: "El umbral para repetir debe ser menor o igual al umbral para avanzar",
  });
export type ProgressionRules = z.infer<typeof progressionRulesSchema>;

export const planVersionSchema = z.object({
  id: z.string().optional(),
  planId: z.string().optional(),
  versionNumber: z.number().int().min(1),
  status: planVersionStatusSchema,
  isDemo: z.boolean(),
  isPremium: z.boolean().default(true),
  name: z.string().trim().min(1).max(120),
  distance: distanceCodeSchema,
  level: levelSchema,
  durationWeeks: z.number().int().min(1).max(24),
  sessionsPerWeek: z.number().int().min(1).max(7),
  objective: z.string().max(1000).default(""),
  entryRequirements: entryRequirementsSchema,
  progressionRules: progressionRulesSchema,
  startWeekRules: z.array(startWeekRuleSchema).default([]),
  scheduleVariants: z.array(scheduleVariantSchema).default([]),
  weeks: z.array(weekSchema).default([]),
  sessions: z.array(sessionSchema).default([]),
  validatedBy: z.string().nullable().default(null),
  validatedAt: z.string().nullable().default(null),
});
export type PlanVersion = z.infer<typeof planVersionSchema>;
export type PlanVersionInput = z.input<typeof planVersionSchema>;

// ---------------------------------------------------------------------------
// Perfil del corredor
// ---------------------------------------------------------------------------

export const recentMarkSchema = z.object({
  distanceM: z.number().int().min(400).max(100000),
  timeS: z.number().int().min(60).max(24 * 3600),
  date: isoDateSchema.nullable().default(null),
});
export type RecentMark = z.infer<typeof recentMarkSchema>;

export const trainingProfileSchema = z.object({
  birthDate: isoDateSchema,
  targetDistance: distanceCodeSchema,
  level: levelSchema,
  experience: experienceSchema,
  weeklyKm: z.number().min(0).max(300),
  availableWeekdays: weekdayListSchema,
  recentMark: recentMarkSchema.nullable().default(null),
  goal: goalSchema,
  raceDate: isoDateSchema.nullable().default(null),
  healthFlags: z.array(healthFlagSchema).default([]),
});
export type TrainingProfile = z.infer<typeof trainingProfileSchema>;
