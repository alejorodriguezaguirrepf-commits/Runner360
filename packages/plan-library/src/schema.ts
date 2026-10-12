import { z } from "zod";

/**
 * Esquema ESTRICTO de content/training-plans/running_plans_library.json.
 * Cualquier campo desconocido, faltante o con otro tipo hace fallar la importación:
 * el contenido se muestra tal cual, así que su forma tiene que ser exactamente la esperada.
 */

const text = z.string().min(1);
const nonNegative = z.number().finite().nonnegative();

export const CATEGORIES = ["rest", "rec", "easy", "mod", "thr", "hard", "race"] as const;
export type Category = (typeof CATEGORIES)[number];
/** Categorías de una sesión de carrera (las de la grilla; "rest" es solo de la leyenda). */
export const SESSION_CATEGORIES = ["rec", "easy", "mod", "thr", "hard", "race"] as const;
export type SessionCategory = (typeof SESSION_CATEGORIES)[number];

export const ZONES = ["Z1", "Z2", "Z3"] as const;
export type Zone = (typeof ZONES)[number];

export const LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const;
export type Level = (typeof LEVELS)[number];

export const STRENGTH_ROUTINES = ["A", "B", "C"] as const;
export type StrengthRoutine = (typeof STRENGTH_ROUTINES)[number];

export const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

const kmhTable = z.record(z.string().regex(/^[a-z0-9]+$/), z.number().positive());

export const intensitySchema = z.strictObject({
  name: text,
  zone: text,
  rpe: text,
  talk_test: text,
  feel: text,
  use: text,
});

export const sessionTypeSchema = z.strictObject({
  code: text,
  name: text,
  description: text,
  purpose: text,
});

export const loadSignalSchema = z.strictObject({
  signal: text,
  continue: text,
  reduce_or_repeat: text,
  stop_and_consult: text,
});

export const strengthExerciseSchema = z.strictObject({
  exercise: text,
  target: text,
  sets_reps: text,
});

const referenceSchema = z.union([text, z.strictObject({ ref: text, use: text })]);

export const restDaySchema = z.strictObject({
  day_index: z.number().int().min(0).max(6),
  day: z.enum(DAY_LABELS),
  is_rest: z.literal(true),
  strength_only: z.boolean(),
});

export const sessionDaySchema = z.strictObject({
  day_index: z.number().int().min(0).max(6),
  day: z.enum(DAY_LABELS),
  is_rest: z.literal(false),
  code: text,
  type: text,
  category: z.enum(SESSION_CATEGORIES),
  short_label: text,
  physiological_goal: text,
  warmup: text,
  main_set: text,
  cooldown: text,
  duration_min_est: z.number().positive(),
  distance_km_est: z.number().positive(),
  intensity: text,
  technical_notes: text,
  strength_after: z.boolean(),
  is_quality: z.boolean(),
  minutes_by_intensity: z.record(text, nonNegative),
});

export const daySchema = z.discriminatedUnion("is_rest", [restDaySchema, sessionDaySchema]);

export const weekSchema = z.strictObject({
  week: z.number().int().min(1),
  phase: text,
  week_type: text,
  week_type_label: text,
  weekly_goal: text,
  progression_criterion: text,
  totals: z.strictObject({
    distance_km_est: nonNegative,
    duration_min_est: nonNegative,
    running_sessions: z.number().int().min(0).max(7),
    strength_sessions: z.number().int().min(0).max(7),
    zone_pct: z.strictObject({ Z1: nonNegative, Z2: nonNegative, Z3: nonNegative }),
    includes_race: z.boolean(),
  }),
  days: z.array(daySchema),
});

export const phaseSchema = z.strictObject({
  weeks: text,
  phase: text,
  goal: text,
  km_range: text.optional(),
});

export const planSchema = z.strictObject({
  id: z.string().regex(/^plan-\d{2}$/),
  number: z.number().int().min(1),
  chapter: z.number().int().min(1),
  distance: text,
  distance_km: z.number().positive(),
  level: z.enum(LEVELS),
  duration_label: text,
  duration_weeks: z.number().int().min(1).max(60),
  days_per_week: z.number().int().min(1).max(7),
  title: text,
  runner_profile: text,
  entry_requirements: z.array(text).min(1),
  min_weekly_km: z.number().positive().nullable(),
  main_goal: text,
  secondary_goals: z.array(text),
  strength_routine: z.enum(STRENGTH_ROUTINES),
  weekly_template: text,
  phases: z.array(phaseSchema).min(1),
  notes: z.array(text),
  validation: z.array(z.strictObject({ check: text, result: text, ok: z.boolean() })),
  weeks: z.array(weekSchema).min(1),
});

export const librarySchema = z.strictObject({
  schema_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  content_version: z.string().regex(/^[0-9A-Za-z.-]{1,40}$/),
  language: z.literal("es-AR"),
  source: z.strictObject({ theoretical_base: text, human_readable: text }),
  model_runner_assumptions: z
    .object({ note: text })
    .catchall(kmhTable)
    .refine((v) => Object.keys(v).every((k) => k === "note" || /^chapter\d+_kmh$/.test(k)), "claves inesperadas"),
  intensity_scale: z.array(intensitySchema).length(6),
  zone_map: z.record(text, z.enum(ZONES)),
  session_catalog: z.array(sessionTypeSchema).min(1),
  category_legend: z.strictObject(Object.fromEntries(CATEGORIES.map((c) => [c, text])) as Record<Category, typeof text>),
  load_monitoring: z.array(loadSignalSchema).min(1),
  practical_rules: z.array(text).min(1),
  strength_routines: z.strictObject({
    A: z.array(strengthExerciseSchema).min(1),
    B: z.array(strengthExerciseSchema).min(1),
    C: z.array(strengthExerciseSchema).min(1),
  }),
  safety: z.array(text).min(1),
  individual_adaptation: z.array(z.strictObject({ situation: text, adaptation: text })),
  glossary: z.array(z.strictObject({ term: text, definition: text })),
  references: z.record(text, z.array(referenceSchema)),
  plans: z.array(planSchema),
});

export type Library = z.infer<typeof librarySchema>;
export type LibraryPlan = z.infer<typeof planSchema>;
export type LibraryWeek = z.infer<typeof weekSchema>;
export type LibraryDay = z.infer<typeof daySchema>;
export type LibrarySessionDay = z.infer<typeof sessionDaySchema>;
export type LibraryRestDay = z.infer<typeof restDaySchema>;
export type Intensity = z.infer<typeof intensitySchema>;
export type LoadSignal = z.infer<typeof loadSignalSchema>;
