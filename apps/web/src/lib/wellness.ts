/**
 * Cuestionario wellness diario (adaptado de McLean y Hooper): cinco ítems de 1 a 5, siempre con
 * 5 = mejor estado, para que el puntaje se lea igual en todos. Total de 5 a 25. Funciones puras:
 * se prueban en test/wellness.test.ts.
 */

export const WELLNESS_KEYS = ["sleep", "energy", "soreness", "stress", "mood"] as const;
export type WellnessKey = (typeof WELLNESS_KEYS)[number];
export type WellnessAnswers = Record<WellnessKey, number>;
export type WellnessRow = WellnessAnswers & { check_date: string; score: number; note: string | null };

export const WELLNESS_ITEMS: Record<WellnessKey, { label: string; short: string; question: string; options: [string, string, string, string, string] }> = {
  sleep: {
    label: "Sueño",
    short: "Sueño",
    question: "¿Cómo dormiste anoche?",
    options: ["Muy mal", "Mal", "Normal", "Bien", "Muy bien"],
  },
  energy: {
    label: "Energía",
    short: "Energía",
    question: "¿Cuánta energía tenés hoy?",
    options: ["Sin energía", "Poca energía", "Normal", "Buena energía", "Mucha energía"],
  },
  soreness: {
    label: "Dolor muscular",
    short: "Músculos",
    question: "¿Cómo están tus músculos?",
    options: ["Mucho dolor", "Bastante dolor", "Algo cargados", "Leves molestias", "Sin dolor"],
  },
  stress: {
    label: "Estrés",
    short: "Estrés",
    question: "¿Cuánto estrés tenés?",
    options: ["Muy alto", "Alto", "Normal", "Bajo", "Nada de estrés"],
  },
  mood: {
    label: "Ánimo",
    short: "Ánimo",
    question: "¿Cómo está tu ánimo?",
    options: ["Muy bajo", "Bajo", "Normal", "Bueno", "Muy bueno"],
  },
};

export type WellnessLevel = "great" | "good" | "fair" | "low";

/** Nivel del puntaje total (5–25). */
export function wellnessLevel(score: number): WellnessLevel {
  if (score >= 20) return "great";
  if (score >= 16) return "good";
  if (score >= 12) return "fair";
  return "low";
}

export const WELLNESS_LEVEL_LABEL: Record<WellnessLevel, string> = { great: "Muy bien", good: "Bien", fair: "Regular", low: "Bajo" };

/** Sugerencia para el día según el puntaje (no reemplaza la indicación del plan ni de un profesional). */
export const WELLNESS_ADVICE: Record<WellnessLevel, string> = {
  great: "Tu recuperación es muy buena: hacé la sesión como está planificada.",
  good: "Buena recuperación: seguí el plan del día.",
  fair: "Recuperación regular: hacé la sesión, pero guiate por las sensaciones y no fuerces de más.",
  low: "Recuperación baja: bajá la intensidad o acortá la sesión. Si te sentís mal, descansá y avisale a tu entrenador.",
};

export function wellnessScore(a: WellnessAnswers): number {
  return WELLNESS_KEYS.reduce((sum, k) => sum + a[k], 0);
}

/** Ítems en 1 o 2: lo que conviene mirar (para el entrenador). */
export function wellnessFlags(a: WellnessAnswers): WellnessKey[] {
  return WELLNESS_KEYS.filter((k) => a[k] <= 2);
}

/** Promedio del puntaje (null sin datos), con un decimal. */
export function averageScore(rows: { score: number }[]): number | null {
  if (!rows.length) return null;
  return Math.round((rows.reduce((s, r) => s + r.score, 0) / rows.length) * 10) / 10;
}
