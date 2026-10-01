/**
 * Dominio compartido de RUNNER 360.
 * Convenciones de unidades (válidas en web, mobile y base de datos):
 * - Distancias: metros enteros (integer). Nunca kilómetros en punto flotante persistidos.
 * - Duraciones: segundos enteros.
 * - Dinero: unidades menores enteras (centavos) + código de moneda ISO 4217.
 * - Volúmenes de hidratación: mililitros enteros.
 */

export const RACE_DISTANCES = ["5k", "10k", "15k", "21k", "42k"] as const;
export type RaceDistance = (typeof RACE_DISTANCES)[number];

export const RACE_DISTANCE_METERS: Record<RaceDistance, number> = {
  "5k": 5000,
  "10k": 10000,
  "15k": 15000,
  "21k": 21097,
  "42k": 42195,
};

export const RACE_DISTANCE_LABELS: Record<RaceDistance, string> = {
  "5k": "5K",
  "10k": "10K",
  "15k": "15K",
  "21k": "Media maratón (21K)",
  "42k": "Maratón (42K)",
};

export const RUNNER_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type RunnerLevel = (typeof RUNNER_LEVELS)[number];

export const RUNNER_LEVEL_LABELS: Record<RunnerLevel, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const TRAINING_GOALS = ["complete", "improve_time", "prepare_race"] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  complete: "Completar la distancia",
  improve_time: "Mejorar mi marca",
  prepare_race: "Preparar una competencia",
};

export const SESSION_TYPES = [
  "easy_run",
  "long_run",
  "intervals",
  "tempo",
  "recovery",
  "rest",
  "strength",
  "test",
  "walk_run",
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy_run: "Rodaje fácil",
  long_run: "Rodaje largo",
  intervals: "Intervalos",
  tempo: "Tempo / umbral",
  recovery: "Recuperación",
  rest: "Descanso",
  strength: "Fuerza complementaria",
  test: "Evaluación / test",
  walk_run: "Caminata y trote",
};

export const INTENSITIES = ["very_easy", "easy", "moderate", "hard", "very_hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const INTENSITY_LABELS: Record<Intensity, string> = {
  very_easy: "Muy suave",
  easy: "Suave",
  moderate: "Moderada",
  hard: "Exigente",
  very_hard: "Muy exigente",
};

export const WORKOUT_STATUSES = ["completed", "modified", "skipped"] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const WORKOUT_STATUS_LABELS: Record<WorkoutStatus, string> = {
  completed: "Completada",
  modified: "Modificada",
  skipped: "No realizada",
};

/** Días ISO: 1 = lunes … 7 = domingo. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
  7: "Dom",
};

export const APP_ROLES = ["user", "coach", "admin"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const BEVERAGE_TYPES = ["water", "sports_drink", "electrolytes", "gel", "other"] as const;
export type BeverageType = (typeof BEVERAGE_TYPES)[number];

export const BEVERAGE_LABELS: Record<BeverageType, string> = {
  water: "Agua",
  sports_drink: "Bebida deportiva",
  electrolytes: "Electrolitos",
  gel: "Gel",
  other: "Otra bebida",
};

export const HYDRATION_CONTEXTS = ["daily", "training", "competition"] as const;
export type HydrationContext = (typeof HYDRATION_CONTEXTS)[number];

export const HYDRATION_CONTEXT_LABELS: Record<HydrationContext, string> = {
  daily: "Día a día",
  training: "Durante entrenamiento",
  competition: "Durante competencia",
};

/** Funcionalidades controladas por suscripción. Se configuran por producto en la base de datos. */
export const FEATURES = [
  "profile",
  "basic_log",
  "demo_plans",
  "premium_plans",
  "calendar",
  "advanced_stats",
  "hydration",
  "competitions",
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABELS: Record<Feature, string> = {
  profile: "Perfil del corredor",
  basic_log: "Registro de entrenamientos",
  demo_plans: "Planes de demostración",
  premium_plans: "Planes publicados Premium",
  calendar: "Calendario de entrenamiento",
  advanced_stats: "Estadísticas avanzadas",
  hydration: "Hidratación",
  competitions: "Competencias",
};

export const CONSENT_TYPES = ["terms", "privacy", "health_data", "location", "marketing"] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Versiones vigentes de los documentos legales (borradores sujetos a revisión legal). */
export const LEGAL_VERSIONS = {
  terms: "2026-10-borrador-1",
  privacy: "2026-10-borrador-1",
  health_data: "2026-10-borrador-1",
} as const;
