import {
  DISTANCE_CODES,
  LEVELS,
  type DistanceCode,
  type Intensity,
  type Level,
  type PlanVersion,
  type ScheduleVariant,
  type Session,
  type SessionType,
  type Week,
} from "../schemas";

/**
 * Generador de planes DEMO / NO VALIDADOS para las 15 combinaciones de distancia y nivel.
 *
 * IMPORTANTE: estos planes son estructuras de ejemplo para probar la plataforma.
 * No fueron diseñados ni aprobados por un profesional y no deben presentarse como prescripción.
 * Usan duraciones conservadoras basadas en tiempo y esfuerzo percibido (RPE), sin ritmos objetivo.
 */

export const DEMO_LABEL = "DEMO / NO VALIDADO";

const LEVEL_ES: Record<Level, string> = { beginner: "Principiante", intermediate: "Intermedio", advanced: "Avanzado" };
const WEEKDAY_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

interface DemoConfig {
  durationWeeks: number;
  longPeakMin: number;
  easyPeakMin: number;
  minWeeklyKm: number;
  minExperienceMonths: number;
}

const CONFIG: Record<DistanceCode, Record<Level, DemoConfig>> = {
  "5K": {
    beginner: { durationWeeks: 8, longPeakMin: 35, easyPeakMin: 30, minWeeklyKm: 0, minExperienceMonths: 0 },
    intermediate: { durationWeeks: 8, longPeakMin: 50, easyPeakMin: 40, minWeeklyKm: 10, minExperienceMonths: 6 },
    advanced: { durationWeeks: 8, longPeakMin: 60, easyPeakMin: 45, minWeeklyKm: 20, minExperienceMonths: 12 },
  },
  "10K": {
    beginner: { durationWeeks: 10, longPeakMin: 60, easyPeakMin: 35, minWeeklyKm: 5, minExperienceMonths: 6 },
    intermediate: { durationWeeks: 10, longPeakMin: 70, easyPeakMin: 45, minWeeklyKm: 15, minExperienceMonths: 6 },
    advanced: { durationWeeks: 10, longPeakMin: 80, easyPeakMin: 50, minWeeklyKm: 30, minExperienceMonths: 12 },
  },
  "15K": {
    beginner: { durationWeeks: 12, longPeakMin: 80, easyPeakMin: 40, minWeeklyKm: 10, minExperienceMonths: 6 },
    intermediate: { durationWeeks: 12, longPeakMin: 90, easyPeakMin: 45, minWeeklyKm: 20, minExperienceMonths: 12 },
    advanced: { durationWeeks: 12, longPeakMin: 100, easyPeakMin: 55, minWeeklyKm: 35, minExperienceMonths: 36 },
  },
  "21K": {
    beginner: { durationWeeks: 16, longPeakMin: 110, easyPeakMin: 45, minWeeklyKm: 15, minExperienceMonths: 6 },
    intermediate: { durationWeeks: 14, longPeakMin: 120, easyPeakMin: 50, minWeeklyKm: 25, minExperienceMonths: 12 },
    advanced: { durationWeeks: 14, longPeakMin: 130, easyPeakMin: 60, minWeeklyKm: 40, minExperienceMonths: 36 },
  },
  "42K": {
    beginner: { durationWeeks: 24, longPeakMin: 150, easyPeakMin: 50, minWeeklyKm: 25, minExperienceMonths: 12 },
    intermediate: { durationWeeks: 20, longPeakMin: 165, easyPeakMin: 55, minWeeklyKm: 35, minExperienceMonths: 12 },
    advanced: { durationWeeks: 18, longPeakMin: 180, easyPeakMin: 65, minWeeklyKm: 50, minExperienceMonths: 36 },
  },
};

const SESSIONS_PER_WEEK: Record<Level, number> = { beginner: 3, intermediate: 4, advanced: 5 };

const STRUCTURE: Record<Level, SessionType[]> = {
  beginner: ["easy_run", "easy_run", "long_run"],
  intermediate: ["easy_run", "intervals", "recovery", "long_run"],
  advanced: ["easy_run", "intervals", "strength", "tempo", "long_run"],
};

const VARIANTS: Record<number, number[][]> = {
  3: [[2, 4, 6], [1, 3, 6], [2, 4, 7], [1, 3, 7], [3, 5, 7], [1, 3, 5]],
  4: [[1, 3, 5, 7], [2, 4, 5, 7], [1, 2, 4, 6], [2, 4, 6, 7]],
  5: [[1, 2, 4, 5, 7], [1, 3, 4, 6, 7], [2, 3, 5, 6, 7]],
};

const STOP_CRITERIA =
  "Reducí o suspendé la sesión ante dolor agudo o que aumenta, mareos, dolor en el pecho, palpitaciones o falta de aire desproporcionada. Si algún síntoma persiste, consultá a un profesional de la salud.";
const PROGRESSION_CRITERIA =
  "Avanzá a la sesión siguiente si completaste esta dentro del rango de esfuerzo indicado y sin dolor. Si no, repetila o consultá a tu entrenador.";

const TYPE_META: Record<SessionType, { title: string; intensity: Intensity; rpe: [number, number] | null }> = {
  easy_run: { title: "Rodaje fácil", intensity: "low", rpe: [3, 4] },
  long_run: { title: "Rodaje largo", intensity: "low", rpe: [3, 5] },
  intervals: { title: "Intervalos", intensity: "high", rpe: [7, 8] },
  tempo: { title: "Tempo", intensity: "moderate", rpe: [6, 7] },
  recovery: { title: "Recuperación", intensity: "very_low", rpe: [2, 3] },
  rest: { title: "Descanso", intensity: "very_low", rpe: null },
  strength: { title: "Fuerza complementaria", intensity: "moderate", rpe: [5, 6] },
  test: { title: "Evaluación", intensity: "high", rpe: null },
};

function roundMinutes(min: number): number {
  return Math.max(10, Math.round(min));
}

/** Factor de carga por semana: progresión lineal, semana de descarga cada 4 y reducción final. */
export function weekLoadFactor(week: number, duration: number): number {
  const buildWeeks = duration - 2;
  const base = 0.75 + (0.25 * Math.min(week - 1, buildWeeks - 1)) / Math.max(1, buildWeeks - 1);
  if (week === duration) return 0.5;
  if (week === duration - 1) return 0.75;
  if (week % 4 === 0) return base * 0.85;
  return base;
}

function sessionFor(distance: DistanceCode, level: Level, cfg: DemoConfig, week: number, n: number, type: SessionType): Session {
  const f = weekLoadFactor(week, cfg.durationWeeks);
  const meta = TYPE_META[type];
  const walkRun = distance === "5K" && level === "beginner" && week <= 4;
  let minutes: number;
  let main: string;
  const warmup = "10 min de caminata o trote muy suave y movilidad articular.";
  const cooldown = "5–10 min de caminata suave y respiración tranquila.";
  switch (type) {
    case "long_run":
      minutes = roundMinutes(cfg.longPeakMin * f);
      main = walkRun
        ? `${minutes - 15} min alternando trote suave y caminata. Ajustá la proporción para mantenerte en RPE 3–5.`
        : `${minutes - 15} min continuos a ritmo conversacional (RPE 3–5).`;
      break;
    case "intervals":
      minutes = roundMinutes(cfg.easyPeakMin * f + 5);
      main = `Bloques de 2–3 min a RPE 7–8 con 2 min de trote o caminata de recuperación, hasta completar ${minutes - 20} min.`;
      break;
    case "tempo":
      minutes = roundMinutes(cfg.easyPeakMin * f);
      main = `${Math.max(10, minutes - 20)} min continuos a ritmo cómodamente exigente (RPE 6–7).`;
      break;
    case "recovery":
      minutes = roundMinutes(cfg.easyPeakMin * f * 0.7);
      main = `${minutes - 10} min de trote muy suave (RPE 2–3). Si hay fatiga marcada, reemplazá por caminata.`;
      break;
    case "strength":
      minutes = 30;
      main = "Circuito de fuerza general con peso corporal: 2–3 vueltas con técnica controlada.";
      break;
    default:
      minutes = roundMinutes(cfg.easyPeakMin * f);
      main = walkRun
        ? `${minutes - 15} min alternando 1–2 min de trote suave y 1–2 min de caminata (RPE 3–4).`
        : `${minutes - 15} min de trote suave a ritmo conversacional (RPE 3–4).`;
  }
  const exercises =
    type === "strength"
      ? [
          { position: 1, name: "Sentadilla", sets: 3, reps: 12, durationS: null, restS: 60, notes: "" },
          { position: 2, name: "Estocadas alternadas", sets: 3, reps: 10, durationS: null, restS: 60, notes: "Por pierna" },
          { position: 3, name: "Puente de glúteos", sets: 3, reps: 12, durationS: null, restS: 45, notes: "" },
          { position: 4, name: "Elevación de talones", sets: 3, reps: 15, durationS: null, restS: 45, notes: "" },
          { position: 5, name: "Plancha frontal", sets: 3, reps: null, durationS: 30, restS: 45, notes: "" },
        ]
      : [];
  return {
    weekNumber: week,
    sessionNumber: n,
    type,
    title: meta.title,
    objective: `Sesión de ejemplo (${DEMO_LABEL}).`,
    distanceM: null,
    durationS: minutes * 60,
    intensity: meta.intensity,
    rpeMin: meta.rpe?.[0] ?? null,
    rpeMax: meta.rpe?.[1] ?? null,
    warmup: type === "strength" ? "5 min de movilidad general." : warmup,
    mainSet: main,
    cooldown: type === "strength" ? "5 min de estiramientos suaves." : cooldown,
    notes: "Contenido DEMO generado para pruebas. No reemplaza la indicación de un profesional.",
    progressionCriteria: PROGRESSION_CRITERIA,
    stopCriteria: STOP_CRITERIA,
    exercises,
  };
}

export function buildDemoPlan(distance: DistanceCode, level: Level): PlanVersion {
  const cfg = CONFIG[distance][level];
  const spw = SESSIONS_PER_WEEK[level];
  const structure = STRUCTURE[level];
  const weeks: Week[] = [];
  const sessions: Session[] = [];
  for (let w = 1; w <= cfg.durationWeeks; w++) {
    const focus =
      w === cfg.durationWeeks ? "Semana final (reducción de carga)" : w % 4 === 0 ? "Semana de descarga" : "Construcción gradual";
    weeks.push({ weekNumber: w, focus, notes: "" });
    structure.forEach((type, i) => sessions.push(sessionFor(distance, level, cfg, w, i + 1, type)));
  }
  const scheduleVariants: ScheduleVariant[] = (VARIANTS[spw] ?? []).map((days, i) => ({
    code: `v${spw}-${String.fromCharCode(97 + i)}`,
    label: days.map((d) => WEEKDAY_SHORT_ES[d - 1]).join(" · "),
    weekdays: days,
    priority: i,
  }));
  return {
    versionNumber: 1,
    status: "published",
    isDemo: true,
    isPremium: !(distance === "5K" && level === "beginner"),
    name: `DEMO · ${distance} ${LEVEL_ES[level]}`,
    distance,
    level,
    durationWeeks: cfg.durationWeeks,
    sessionsPerWeek: spw,
    objective: `Plan de demostración ${DEMO_LABEL}. Estructura de ejemplo para probar la plataforma; no constituye una prescripción profesional.`,
    entryRequirements: {
      minWeeklyKm: cfg.minWeeklyKm,
      minExperienceMonths: cfg.minExperienceMonths,
      minAge: 18,
      notes: "Requisitos de ejemplo (DEMO).",
    },
    progressionRules: {
      minComplianceToAdvance: 0.6,
      repeatWeekBelowCompliance: 0.4,
      reviewAboveAvgRpe: 8.5,
      reviewOnPainReport: true,
      maxWeeklyVolumeIncreasePct: 15,
    },
    startWeekRules: cfg.durationWeeks >= 12 ? [{ minWeeklyKm: cfg.minWeeklyKm + 15, startWeek: 3 }] : [],
    scheduleVariants,
    weeks,
    sessions,
    validatedBy: null,
    validatedAt: null,
  };
}

export function buildAllDemoPlans(): PlanVersion[] {
  return DISTANCE_CODES.flatMap((d) => LEVELS.map((l) => buildDemoPlan(d, l)));
}
