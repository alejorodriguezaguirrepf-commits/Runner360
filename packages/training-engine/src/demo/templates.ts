import {
  RACE_DISTANCES,
  RACE_DISTANCE_LABELS,
  RUNNER_LEVELS,
  RUNNER_LEVEL_LABELS,
  type RaceDistance,
  type RunnerLevel,
} from "@runner360/shared";
import type { PlanSession, PlanVersion, PlanWeek, ScheduleVariant } from "../model";

/**
 * PLANES DE DEMOSTRACIÓN — NO VALIDADOS PROFESIONALMENTE.
 *
 * Existen únicamente para probar el flujo del producto (asignación, calendario, registro y progreso).
 * Son deliberadamente conservadores: sesiones por tiempo, intensidades mayormente suaves, semanas de
 * descarga y reducción final de carga. NO constituyen una prescripción deportiva. Deben ser reemplazados
 * por planes cargados y aprobados por el responsable metodológico desde el panel administrativo.
 */

export const DEMO_LABEL = "DEMO / NO VALIDADO";

/** Duraciones de referencia (semanas) por distancia y nivel. Configurables. */
export const DEMO_DURATION_WEEKS: Record<RaceDistance, Record<RunnerLevel, number>> = {
  "5k": { beginner: 8, intermediate: 8, advanced: 8 },
  "10k": { beginner: 10, intermediate: 10, advanced: 10 },
  "15k": { beginner: 12, intermediate: 12, advanced: 12 },
  "21k": { beginner: 16, intermediate: 14, advanced: 14 },
  "42k": { beginner: 20, intermediate: 18, advanced: 18 },
};

/** Requisitos de ingreso de referencia (placeholder a revisar por el fundador). [km/semana, meses] */
export const DEMO_ENTRY: Record<RaceDistance, Record<RunnerLevel, [number, number]>> = {
  "5k": { beginner: [5, 1], intermediate: [15, 6], advanced: [25, 12] },
  "10k": { beginner: [10, 3], intermediate: [20, 6], advanced: [30, 12] },
  "15k": { beginner: [15, 4], intermediate: [25, 9], advanced: [35, 12] },
  "21k": { beginner: [20, 6], intermediate: [30, 12], advanced: [40, 18] },
  "42k": { beginner: [30, 12], intermediate: [40, 18], advanced: [50, 24] },
};

const SESSIONS_PER_WEEK: Record<RunnerLevel, number> = { beginner: 3, intermediate: 4, advanced: 5 };

const DISTANCE_FACTOR: Record<RaceDistance, number> = {
  "5k": 1,
  "10k": 1.1,
  "15k": 1.2,
  "21k": 1.3,
  "42k": 1.45,
};

const VARIANTS: Record<number, ScheduleVariant[]> = {
  3: [
    {
      id: "3d",
      label: "3 días con al menos un día libre entre sesiones",
      weekdayPatterns: [
        [2, 4, 6],
        [1, 3, 6],
        [2, 4, 7],
        [1, 3, 7],
        [1, 4, 6],
        [2, 5, 7],
        [1, 3, 5],
        [3, 5, 7],
      ],
    },
  ],
  4: [
    {
      id: "4d",
      label: "4 días con rodaje largo en fin de semana",
      weekdayPatterns: [
        [1, 3, 5, 7],
        [2, 4, 5, 7],
        [1, 2, 4, 6],
        [2, 3, 5, 7],
        [1, 3, 4, 6],
      ],
    },
  ],
  5: [
    {
      id: "5d",
      label: "5 días con dos descansos",
      weekdayPatterns: [
        [1, 2, 4, 5, 7],
        [2, 3, 5, 6, 7],
        [1, 2, 3, 5, 6],
        [1, 3, 4, 6, 7],
      ],
    },
  ],
};

const STRENGTH_EXERCISES = [
  "Sentadilla con peso corporal",
  "Puente de glúteos",
  "Elevación de talones",
  "Plancha frontal",
].map((name, i) => ({
  order: i + 1,
  name,
  sets: 2,
  reps: name.includes("Plancha") ? null : 12,
  durationS: name.includes("Plancha") ? 30 : null,
  distanceM: null,
  restS: 60,
  notes: null,
}));

const min = (m: number) => Math.round(m) * 60;
const roundMin = (m: number) => Math.max(10, Math.round(m));

function weekPhase(week: number, total: number): "build" | "deload" | "taper" | "race" {
  if (week === total) return "race";
  if (total >= 12 && week === total - 1) return "taper";
  if (week % 4 === 0) return "deload";
  return "build";
}

function session(partial: Partial<PlanSession> & Pick<PlanSession, "sessionNumber" | "daySlot" | "type" | "title">): PlanSession {
  return {
    objective: "",
    distanceM: null,
    durationS: null,
    intensity: "easy",
    rpeMin: null,
    rpeMax: null,
    warmup: "",
    mainSet: "",
    cooldown: "",
    notes: `${DEMO_LABEL}. Sesión de ejemplo sin validación profesional.`,
    exercises: [],
    ...partial,
  };
}

export function buildDemoPlan(distance: RaceDistance, level: RunnerLevel): PlanVersion {
  const duration = DEMO_DURATION_WEEKS[distance][level];
  const perWeek = SESSIONS_PER_WEEK[level];
  const [minKm, minMonths] = DEMO_ENTRY[distance][level];
  const baseEasy = { beginner: 20, intermediate: 30, advanced: 35 }[level];
  const baseLong = { beginner: 30, intermediate: 45, advanced: 55 }[level] * DISTANCE_FACTOR[distance];
  const longCap = { beginner: 90, intermediate: 120, advanced: 140 }[level];

  const weeks: PlanWeek[] = [];
  let buildIndex = 0;
  let lastBuildFactor = 1;
  for (let w = 1; w <= duration; w++) {
    const phase = weekPhase(w, duration);
    let factor: number;
    if (phase === "build") {
      factor = 1 + 0.07 * buildIndex++;
      lastBuildFactor = factor;
    } else if (phase === "deload") factor = lastBuildFactor * 0.8;
    else if (phase === "taper") factor = lastBuildFactor * 0.7;
    else factor = lastBuildFactor * 0.5;

    const easy = roundMin(baseEasy * factor);
    const long = Math.min(longCap, roundMin(baseLong * factor));
    const quality = phase === "build" && w >= 3;
    const sessions: PlanSession[] = [];
    let n = 1;

    const easyRun = (slot: number): PlanSession =>
      session({
        sessionNumber: n++,
        daySlot: slot,
        type: level === "beginner" && distance === "5k" && w <= 2 ? "walk_run" : "easy_run",
        title: "Rodaje fácil",
        objective: "Acumular tiempo de carrera a intensidad conversacional.",
        durationS: min(easy),
        intensity: "easy",
        rpeMin: 3,
        rpeMax: 4,
        warmup: "5 min de caminata activa y movilidad articular.",
        mainSet: `${easy} min de trote suave, a un ritmo que permita conversar.`,
        cooldown: "5 min de caminata.",
      });

    // Las sesiones de calidad reemplazan un rodaje fácil con la MISMA duración total,
    // para no generar saltos de carga semanal.
    const qualitySession = (slot: number, kind: "intervals" | "tempo"): PlanSession => {
      const hard = level === "advanced";
      if (kind === "intervals") {
        const reps = Math.max(2, Math.min(hard ? 8 : 6, Math.floor((easy - 20) / 4)));
        return session({
          sessionNumber: n++,
          daySlot: slot,
          type: "intervals",
          title: "Intervalos",
          objective: "Introducir estímulos de mayor intensidad con recuperaciones completas.",
          durationS: min(easy),
          intensity: hard ? "hard" : "moderate",
          rpeMin: 6,
          rpeMax: hard ? 8 : 7,
          warmup: "12 min de trote suave + 3 progresivos de 20 s.",
          mainSet: `${reps} × 2 min a RPE ${hard ? "7-8" : "6-7"}, con 2 min de trote muy suave entre repeticiones.`,
          cooldown: "8 min de trote muy suave (completar el tiempo total con trote suave).",
        });
      }
      const block = Math.max(4, Math.floor((easy - 23) / 2));
      return session({
        sessionNumber: n++,
        daySlot: slot,
        type: "tempo",
        title: "Tempo",
        objective: "Sostener un esfuerzo moderado y controlado.",
        durationS: min(easy),
        intensity: "moderate",
        rpeMin: 5,
        rpeMax: hard ? 7 : 6,
        warmup: "12 min de trote suave.",
        mainSet: `2 × ${block} min a ritmo cómodo-exigente (RPE ${hard ? "6-7" : "5-6"}), con 3 min suaves entre bloques.`,
        cooldown: "8 min de trote muy suave (completar el tiempo total con trote suave).",
      });
    };

    const longRun = (slot: number): PlanSession =>
      session({
        sessionNumber: n++,
        daySlot: slot,
        type: "long_run",
        title: phase === "race" ? "Semana objetivo" : "Rodaje largo",
        objective:
          phase === "race"
            ? "Semana de la competencia: llegar descansado. Si no competís, rodaje suave."
            : "Desarrollar resistencia aeróbica con un esfuerzo sostenido y suave.",
        durationS: min(long),
        intensity: "easy",
        rpeMin: 3,
        rpeMax: 5,
        warmup: "5 min de caminata activa.",
        mainSet: `${long} min continuos a ritmo suave. Hidratate según la duración y el clima.`,
        cooldown: "5 min de caminata y estiramientos suaves.",
      });

    const strength = (slot: number): PlanSession =>
      session({
        sessionNumber: n++,
        daySlot: slot,
        type: "strength",
        title: "Fuerza complementaria",
        objective: "Fortalecer la musculatura de soporte para la carrera.",
        durationS: min(25),
        intensity: "moderate",
        rpeMin: 4,
        rpeMax: 6,
        warmup: "5 min de movilidad.",
        mainSet: "Circuito con peso corporal (ver ejercicios). Técnica controlada, sin llegar al fallo.",
        cooldown: "5 min de movilidad suave.",
        exercises: STRENGTH_EXERCISES,
      });

    const recovery = (slot: number): PlanSession =>
      session({
        sessionNumber: n++,
        daySlot: slot,
        type: "recovery",
        title: "Recuperación",
        objective: "Facilitar la recuperación con muy baja intensidad.",
        durationS: min(roundMin(easy * 0.7)),
        intensity: "very_easy",
        rpeMin: 2,
        rpeMax: 3,
        warmup: "Caminata de 3 min.",
        mainSet: `${roundMin(easy * 0.7)} min de trote muy suave o caminata rápida.`,
        cooldown: "Movilidad suave.",
      });

    if (perWeek === 3) {
      sessions.push(easyRun(1));
      sessions.push(level !== "beginner" && quality ? qualitySession(2, "tempo") : easyRun(2));
      sessions.push(longRun(3));
    } else if (perWeek === 4) {
      sessions.push(easyRun(1));
      sessions.push(quality ? qualitySession(2, w % 2 === 0 ? "tempo" : "intervals") : easyRun(2));
      sessions.push(strength(3));
      sessions.push(longRun(4));
    } else {
      sessions.push(easyRun(1));
      sessions.push(quality ? qualitySession(2, "intervals") : easyRun(2));
      sessions.push(recovery(3));
      sessions.push(quality ? qualitySession(4, "tempo") : easyRun(4));
      sessions.push(longRun(5));
    }

    weeks.push({
      weekNumber: w,
      focus: { build: "Construcción", deload: "Descarga", taper: "Reducción de carga", race: "Semana objetivo" }[phase],
      notes: `${DEMO_LABEL}.`,
      sessions,
    });
  }

  return {
    version: 1,
    name: `${RACE_DISTANCE_LABELS[distance]} · ${RUNNER_LEVEL_LABELS[level]} (${DEMO_LABEL})`,
    kind: "standard",
    targetDistance: distance,
    level,
    durationWeeks: duration,
    sessionsPerWeek: perWeek,
    objective: `Plan de demostración para ${RACE_DISTANCE_LABELS[distance]}, nivel ${RUNNER_LEVEL_LABELS[level].toLowerCase()}. No validado profesionalmente: sirve para conocer cómo funciona RUNNER 360.`,
    entryRequirements: {
      minWeeklyDistanceM: minKm * 1000,
      minExperienceMonths: minMonths,
      requiresHealthClearance: true,
      notes: `${DEMO_LABEL}: requisitos de referencia pendientes de revisión.`,
    },
    progressionCriteria:
      "Avanzar de semana si se completó al menos el 70% de las sesiones y el esfuerzo percibido se mantuvo dentro de lo planificado.",
    reduceOrStopCriteria:
      "Reducir o suspender ante dolor que modifica la pisada, mareos, dolor en el pecho, falta de aire desproporcionada, fiebre o malestar general. Ante cualquiera de estos signos, consultá a un profesional de la salud.",
    progressionRules: {
      minWeeklyCompliance: 0.7,
      rpeOverTargetMargin: 2,
      rpeOverTargetSessions: 2,
      maxWeeklyLoadIncreasePct: 10,
      maxSkippableWeeks: 2,
    },
    scheduleVariants: VARIANTS[perWeek]!,
    isDemo: true,
    validationStatus: "demo_unvalidated",
    status: "published",
    requiresPremium: false,
    approvedAt: null,
    weeks,
  };
}

/** Fase introductoria (caminata y trote) recomendada cuando no hay base suficiente. DEMO. */
export function buildDemoIntroductoryPlan(): PlanVersion {
  const weeks: PlanWeek[] = [];
  const blocks = [
    ["8 × (1 min trote + 2 min caminata)", 24, 1],
    ["8 × (1 min trote + 1:30 min caminata)", 25, 1],
    ["6 × (2 min trote + 2 min caminata)", 24, 2],
    ["6 × (2 min trote + 1:30 min caminata)", 21, 2],
    ["5 × (3 min trote + 1:30 min caminata)", 23, 3],
    ["4 × (4 min trote + 1:30 min caminata)", 22, 4],
    ["3 × (6 min trote + 2 min caminata)", 24, 6],
    ["2 × (10 min trote + 2 min caminata)", 24, 10],
  ] as const;
  blocks.forEach(([main, total], i) => {
    const sessions: PlanSession[] = [1, 2, 3].map((slot) =>
      session({
        sessionNumber: slot,
        daySlot: slot,
        type: "walk_run",
        title: "Caminata y trote",
        objective: "Construir tolerancia progresiva a la carrera alternando trote y caminata.",
        durationS: min(total + 10),
        intensity: "easy",
        rpeMin: 3,
        rpeMax: 4,
        warmup: "5 min de caminata activa.",
        mainSet: `${main}. El trote debe permitir hablar con frases completas.`,
        cooldown: "5 min de caminata.",
      }),
    );
    weeks.push({ weekNumber: i + 1, focus: "Fase introductoria", notes: `${DEMO_LABEL}.`, sessions });
  });
  return {
    version: 1,
    name: `Fase introductoria: caminar y trotar (${DEMO_LABEL})`,
    kind: "introductory",
    targetDistance: "5k",
    level: "beginner",
    durationWeeks: 8,
    sessionsPerWeek: 3,
    objective:
      "Fase previa para construir una base mínima antes de iniciar un plan específico. Plan de demostración no validado profesionalmente.",
    entryRequirements: {
      minWeeklyDistanceM: 0,
      minExperienceMonths: 0,
      requiresHealthClearance: true,
      notes: "Recomendado consultar a un profesional de la salud antes de comenzar a entrenar.",
    },
    progressionCriteria: "Avanzar si las sesiones de la semana se completaron sin dolor y con esfuerzo cómodo.",
    reduceOrStopCriteria:
      "Detener la sesión ante dolor, mareos, dolor en el pecho o falta de aire desproporcionada y consultar a un profesional de la salud.",
    progressionRules: {
      minWeeklyCompliance: 0.67,
      rpeOverTargetMargin: 2,
      rpeOverTargetSessions: 2,
      maxWeeklyLoadIncreasePct: 10,
      maxSkippableWeeks: 0,
    },
    scheduleVariants: VARIANTS[3]!,
    isDemo: true,
    validationStatus: "demo_unvalidated",
    status: "published",
    requiresPremium: false,
    approvedAt: null,
    weeks,
  };
}

export function buildAllDemoPlans(): PlanVersion[] {
  const plans: PlanVersion[] = [buildDemoIntroductoryPlan()];
  for (const d of RACE_DISTANCES) for (const l of RUNNER_LEVELS) plans.push(buildDemoPlan(d, l));
  return plans;
}
