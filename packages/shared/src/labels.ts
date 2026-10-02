import type { DistanceCode, Experience, Goal, HealthFlag, Intensity, Level, SessionType } from "@runner360/training-engine";

/** Etiquetas de interfaz en español de Argentina. */

export const DISTANCE_LABELS: Record<DistanceCode, string> = {
  "5K": "5 km",
  "10K": "10 km",
  "15K": "15 km",
  "21K": "21 km (media maratón)",
  "42K": "42 km (maratón)",
};

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: "Todavía no corro",
  lt_6m: "Menos de 6 meses",
  "6_12m": "Entre 6 y 12 meses",
  "1_3y": "Entre 1 y 3 años",
  gt_3y: "Más de 3 años",
};

export const GOAL_LABELS: Record<Goal, string> = {
  complete: "Completar la distancia",
  improve: "Mejorar mi marca",
  race: "Preparar una competencia",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  easy_run: "Rodaje fácil",
  long_run: "Rodaje largo",
  intervals: "Intervalos",
  tempo: "Tempo / umbral",
  recovery: "Recuperación",
  rest: "Descanso",
  strength: "Fuerza complementaria",
  test: "Evaluación",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  very_low: "Muy baja",
  low: "Baja",
  moderate: "Moderada",
  high: "Alta",
  very_high: "Muy alta",
};

export const HEALTH_FLAG_LABELS: Record<HealthFlag, string> = {
  medical_restriction: "Un profesional de la salud me indicó limitar la actividad física",
  cardiovascular_or_respiratory_condition: "Tengo una condición cardiovascular o respiratoria diagnosticada",
  chest_pain_or_fainting: "Tuve dolor en el pecho, desmayos o mareos al hacer ejercicio",
  recent_injury: "Tengo o tuve una lesión en los últimos 3 meses",
  pregnancy_or_postpartum: "Estoy cursando un embarazo o un posparto reciente",
  other: "Otra situación que preferiría consultar",
};

export const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export const WORKOUT_STATUS_LABELS = {
  completed: "Completada",
  modified: "Modificada",
  skipped: "No realizada",
} as const;

export const CALENDAR_STATUS_LABELS = {
  pending: "Pendiente",
  ...WORKOUT_STATUS_LABELS,
} as const;

export const BEVERAGE_LABELS = {
  water: "Agua",
  sports_drink: "Bebida deportiva",
  electrolytes: "Electrolitos",
  gel: "Gel",
  other: "Otra",
} as const;

export const HYDRATION_CONTEXT_LABELS = {
  daily: "Diario",
  training: "Durante el entrenamiento",
  competition: "Durante una competencia",
} as const;

export const COMPETITION_STATUS_LABELS = {
  planned: "Planificada",
  completed: "Finalizada",
  dns: "No largué",
  dnf: "No finalicé",
} as const;

export const ROLE_LABELS = { user: "Usuario", coach: "Entrenador", admin: "Administrador" } as const;

export const PLAN_STATUS_LABELS = {
  draft: "Borrador",
  in_review: "En revisión",
  published: "Publicado",
  archived: "Archivado",
} as const;

export const SUBSCRIPTION_STATUS_LABELS = {
  pending: "Pendiente",
  trialing: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  cancelled: "Cancelada",
  expired: "Vencida",
} as const;

export const READINESS_MESSAGES = {
  HEALTH_FLAGS_DECLARED:
    "Indicaste antecedentes que conviene revisar con un profesional de la salud antes de comenzar un plan.",
  UNDER_MIN_AGE: "Para menores de 18 años recomendamos el acompañamiento de un profesional y de un adulto responsable.",
  NO_RUNNING_BASE_FOR_DISTANCE:
    "Para esta distancia conviene construir primero una base de carrera. Te sugerimos empezar por una fase introductoria (plan de 5 km principiante).",
  LEVEL_INCONSISTENT_WITH_EXPERIENCE:
    "El nivel elegido no coincide con tu experiencia actual. Te sugerimos comenzar con una fase introductoria.",
} as const;
