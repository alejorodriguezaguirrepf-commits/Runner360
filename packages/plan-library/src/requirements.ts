import type { LibraryPlan } from "./schema";

/**
 * Requisitos de ingreso: cada texto del contenido se clasifica para poder compararlo con las
 * respuestas del asistente. El texto se muestra siempre tal cual; acá solo se extraen los umbrales
 * que el propio texto declara (minutos continuos, km de la tirada larga, etc.).
 * Si aparece un requisito que no se reconoce, el test de clasificación falla: hay que revisarlo.
 */
export type Requirement =
  | { kind: "continuous_run"; minutes: number; text: string }
  | { kind: "brisk_walk"; minutes: number; text: string }
  | { kind: "weekly_volume"; km: number; text: string }
  | { kind: "long_run"; km: number; text: string }
  | { kind: "days_available"; days: number; text: string }
  | { kind: "habitual_days"; days: number; text: string }
  | { kind: "pace_experience"; level: "rhythm" | "threshold_intervals"; text: string }
  | { kind: "recent_mark"; distances: number[]; testAllowed: boolean; text: string }
  | { kind: "completed_race"; halfMarathon: boolean; marathonRequired: boolean; text: string }
  | { kind: "no_active_injury"; text: string }
  | { kind: "medical_check"; text: string }
  | { kind: "info"; text: string };

/** "1 h 30'" → 90; "55'" → 55. */
function minutesIn(text: string): number | null {
  const m = /(?:(\d+)\s*h\s*)?(\d+)'/.exec(text);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null;
}

const num = (s: string) => Number(s.replace(",", "."));

export function classifyRequirement(text: string, plan: Pick<LibraryPlan, "duration_weeks">): Requirement[] {
  const t = text.toLowerCase();
  const out: Requirement[] = [];
  let m: RegExpExecArray | null;

  if ((m = /volumen habitual de al menos (\d+(?:,\d+)?) km/.exec(t))) out.push({ kind: "weekly_volume", km: num(m[1]!), text });
  else if ((m = /tirada larga reciente de al menos (\d+(?:,\d+)?) km/.exec(t))) out.push({ kind: "long_run", km: num(m[1]!), text });
  else if (t.startsWith("correr ") && t.includes("continuos")) out.push({ kind: "continuous_run", minutes: minutesIn(text) ?? 0, text });
  else if (t.startsWith("caminar ")) out.push({ kind: "brisk_walk", minutes: minutesIn(text) ?? 0, text });
  else if ((m = /^(\d) días disponibles por semana/.exec(t))) out.push({ kind: "days_available", days: Number(m[1]), text });
  else if (t.startsWith("entrenar habitualmente")) {
    m = /(\d) días por semana/.exec(t);
    out.push({ kind: "habitual_days", days: Number(m?.[1] ?? 0), text });
    out.push({ kind: "pace_experience", level: "threshold_intervals", text });
  } else if (t.startsWith("experiencia previa con alguna sesión de ritmo")) out.push({ kind: "pace_experience", level: "rhythm", text });
  else if (t.startsWith("una marca reciente")) {
    const distances = [...t.matchAll(/(\d+(?:,\d+)?)\s*(?:o|km)/g)].map((x) => num(x[1]!)).filter((d) => [5, 10, 21.1].includes(d));
    out.push({ kind: "recent_mark", distances: [...new Set(distances)], testAllowed: t.includes("test de 30'"), text });
  } else if (t.startsWith("haber completado al menos una media maratón")) {
    // "recomendable un maratón previo — imprescindible en el plan de 3 meses"
    out.push({ kind: "completed_race", halfMarathon: true, marathonRequired: t.includes("imprescindible en el plan de 3 meses") && plan.duration_weeks <= 12, text });
  } else if (t.startsWith("sin lesión activa")) {
    out.push({ kind: "no_active_injury", text });
    if (t.includes("consulta médica")) out.push({ kind: "medical_check", text });
  } else if (t.startsWith("si hay enfermedad")) out.push({ kind: "medical_check", text });
  else if (t.startsWith("no requiere experiencia")) out.push({ kind: "info", text });
  return out;
}

export function planRequirements(plan: Pick<LibraryPlan, "entry_requirements" | "duration_weeks">): Requirement[] {
  return plan.entry_requirements.flatMap((text) => classifyRequirement(text, plan));
}

/** Requisitos que no se pudieron clasificar (debe ser vacío para todo el contenido). */
export function unclassifiedRequirements(plan: Pick<LibraryPlan, "entry_requirements" | "duration_weeks">): string[] {
  return plan.entry_requirements.filter((text) => classifyRequirement(text, plan).length === 0);
}

// ---------------------------------------------------------------- Evaluación inicial
export const EXPERIENCE_LEVELS = ["none", "rhythm", "threshold_intervals"] as const;
export type PaceExperience = (typeof EXPERIENCE_LEVELS)[number];

/** Respuestas del asistente "¿Cuál es mi plan?" (evaluación inicial). */
export type Assessment = {
  /** Meses corriendo de forma regular (0 = no corre). */
  runningMonths: number;
  weeklyKm: number;
  /** Días por semana que corre hoy. */
  currentDays: number;
  continuousMinutes: number;
  /** Puede caminar 30' a paso ligero sin molestias. */
  canBriskWalk: boolean;
  longRunKm: number;
  daysAvailable: number;
  paceExperience: PaceExperience;
  activeInjury: boolean;
  overuseInjuryHistory: boolean;
  /** Enfermedad conocida, síntomas al esfuerzo o dudas sobre la salud. */
  healthFlag: boolean;
  /** Si hay healthFlag: ya hizo la consulta médica y tiene el apto. */
  medicalClearance: boolean;
  completedHalfMarathon: boolean;
  completedMarathon: boolean;
  /** Marca reciente (≤ 8 semanas). */
  recentMark: { distanceKm: number; timeS: number; date: string } | null;
  raceDate: string | null;
};

export type CheckStatus = "met" | "unmet" | "pending";
export type RequirementCheck = { requirement: Requirement; status: CheckStatus };

/** "met": cumple; "unmet": no cumple (bloquea); "pending": se puede resolver antes de empezar (no bloquea). */
export function checkRequirement(r: Requirement, a: Assessment, opts: { today: string }): CheckStatus {
  switch (r.kind) {
    case "continuous_run":
      return a.continuousMinutes >= r.minutes ? "met" : "unmet";
    case "brisk_walk":
      return a.canBriskWalk || a.continuousMinutes >= r.minutes ? "met" : "unmet";
    case "weekly_volume":
      return a.weeklyKm >= r.km ? "met" : "unmet";
    case "long_run":
      return a.longRunKm >= r.km ? "met" : "unmet";
    case "days_available":
      return a.daysAvailable >= r.days ? "met" : "unmet";
    case "habitual_days":
      return a.currentDays >= r.days ? "met" : "unmet";
    case "pace_experience":
      return a.paceExperience === "threshold_intervals" || (r.level === "rhythm" && a.paceExperience === "rhythm") ? "met" : "unmet";
    case "recent_mark": {
      const recent = a.recentMark && withinWeeks(a.recentMark.date, opts.today, 8) && r.distances.some((d) => Math.abs(d - a.recentMark!.distanceKm) < 0.2);
      // Sin marca: se puede hacer el test de 30' (si el plan lo admite) antes de empezar.
      return recent ? "met" : r.testAllowed ? "pending" : "unmet";
    }
    case "completed_race":
      if (r.marathonRequired) return a.completedMarathon ? "met" : "unmet";
      return a.completedHalfMarathon || a.completedMarathon ? "met" : "unmet";
    case "no_active_injury":
      return a.activeInjury ? "unmet" : "met";
    case "medical_check":
      return !a.healthFlag || a.medicalClearance ? "met" : "unmet";
    case "info":
      return "met";
  }
}

function withinWeeks(date: string, today: string, weeks: number): boolean {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`);
  return ms >= 0 && ms <= weeks * 7 * 86_400_000;
}

export function assessPlan<P extends Pick<LibraryPlan, "entry_requirements" | "duration_weeks">>(plan: P, a: Assessment, opts: { today: string }) {
  const checks: RequirementCheck[] = planRequirements(plan).map((requirement) => ({ requirement, status: checkRequirement(requirement, a, opts) }));
  return { plan, checks, eligible: checks.every((c) => c.status !== "unmet") };
}
