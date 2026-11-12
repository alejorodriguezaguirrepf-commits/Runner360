/**
 * Fuerza (desde el contenido 2026.13): cada rutina (A principiante, B intermedio, C avanzado) tiene dos
 * sesiones de 5 ejercicios — dos básicos de tren inferior (uno dominante de rodilla y uno de cadera),
 * un auxiliar de tren inferior (rodilla en la sesión 1, cadera en la 2), un empuje y una tracción de
 * tren superior (horizontales en la sesión 1, verticales en la 2).
 *
 * Dosificación con variación de cargas (ondulante): la sesión 1 de la semana es la más pesada (menos
 * repeticiones) y la 2 la más liviana; además cambia según el momento del plan (base → desarrollo →
 * específico) y el tipo de semana (carga, descarga, puesta a punto, competencia). Siempre entre 3 y 6
 * repeticiones y no más de 4 series. La carga se regula con repeticiones en reserva (RIR).
 */

export const STRENGTH_PATTERNS = ["knee_basic", "hip_basic", "knee_aux", "hip_aux", "push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"] as const;
export type StrengthPattern = (typeof STRENGTH_PATTERNS)[number];
export type StrengthSessionNumber = 1 | 2;

export const PATTERN_LABELS: Record<StrengthPattern, string> = {
  knee_basic: "Tren inferior · básico · dominante de rodilla",
  hip_basic: "Tren inferior · básico · dominante de cadera",
  knee_aux: "Tren inferior · auxiliar · dominante de rodilla",
  hip_aux: "Tren inferior · auxiliar · dominante de cadera",
  push_horizontal: "Tren superior · empuje horizontal",
  pull_horizontal: "Tren superior · tracción horizontal",
  push_vertical: "Tren superior · empuje vertical",
  pull_vertical: "Tren superior · tracción vertical",
};

/** Lo que tiene que tener cada sesión, en orden. */
export const SESSION_PATTERNS: Record<StrengthSessionNumber, StrengthPattern[]> = {
  1: ["knee_basic", "hip_basic", "knee_aux", "push_horizontal", "pull_horizontal"],
  2: ["knee_basic", "hip_basic", "hip_aux", "push_vertical", "pull_vertical"],
};

export type StrengthLevel = "A" | "B" | "C";
export type StrengthDose = { sets: number; reps: number; rir: number; phase: StrengthPhase; note: string | null };
export type StrengthPhase = "base" | "development" | "specific" | "deload" | "taper" | "race";

export const PHASE_LABELS: Record<StrengthPhase, string> = {
  base: "Base",
  development: "Desarrollo",
  specific: "Específico",
  deload: "Semana de descarga",
  taper: "Puesta a punto",
  race: "Semana de competencia",
};

const DELOAD = new Set(["D", "DC", "DCT", "DCOMP", "TRANS", "REC1", "REC2", "REC3"]);
const TAPER = new Set(["T1", "T2"]);

/** Momento del plan para la fuerza: el tipo de semana manda; en las de carga, el avance del plan. */
export function strengthPhase(weekType: string, week: number, totalWeeks: number): StrengthPhase {
  if (weekType === "RACE") return "race";
  if (TAPER.has(weekType)) return "taper";
  if (DELOAD.has(weekType)) return "deload";
  const progress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;
  if (progress < 0.4) return "base";
  if (progress < 0.75) return "development";
  return "specific";
}

/** Series × repeticiones y RIR por momento y sesión (1 = pesada, 2 = liviana). */
const TABLE: Record<StrengthPhase, Record<StrengthSessionNumber, { sets: number; reps: number; rir: number }>> = {
  base: { 1: { sets: 3, reps: 5, rir: 3 }, 2: { sets: 3, reps: 6, rir: 3 } },
  development: { 1: { sets: 4, reps: 4, rir: 2 }, 2: { sets: 3, reps: 6, rir: 2 } },
  specific: { 1: { sets: 4, reps: 3, rir: 2 }, 2: { sets: 3, reps: 5, rir: 2 } },
  deload: { 1: { sets: 2, reps: 5, rir: 4 }, 2: { sets: 2, reps: 5, rir: 4 } },
  taper: { 1: { sets: 2, reps: 3, rir: 3 }, 2: { sets: 2, reps: 4, rir: 3 } },
  race: { 1: { sets: 2, reps: 3, rir: 4 }, 2: { sets: 2, reps: 3, rir: 4 } },
};

const NOTES: Partial<Record<StrengthPhase, string>> = {
  deload: "Carga liviana: la semana es para recuperar.",
  taper: "Pocas series para mantener la fuerza sin llegar cansado a la carrera.",
  race: "Liviana y al menos 3 días antes de la competencia. Si dudás, saltéala.",
};

export function strengthDose(input: { weekType: string; week: number; totalWeeks: number; session: StrengthSessionNumber; level: StrengthLevel }): StrengthDose {
  const phase = strengthPhase(input.weekType, input.week, input.totalWeeks);
  const base = TABLE[phase][input.session];
  // Principiantes: una repetición más en reserva (aprender la técnica con margen).
  const rir = Math.min(4, base.rir + (input.level === "A" ? 1 : 0));
  return { sets: base.sets, reps: base.reps, rir, phase, note: NOTES[phase] ?? null };
}

/** "4 × 4 · 2 en reserva". */
export function doseLabel(d: StrengthDose): string {
  return `${d.sets} × ${d.reps} · ${d.rir} en reserva`;
}

/** Ejercicios a una pierna: las repeticiones son por pierna. */
export function perSide(pattern: StrengthPattern): boolean {
  return pattern === "knee_aux";
}

/**
 * Qué sesión de fuerza corresponde a un día: se cuentan los días con fuerza de la semana en orden
 * (después de correr o días de solo fuerza) y se alternan 1, 2, 1…
 */
export function strengthSessionOf(days: { day_index: number; is_rest: boolean; strength_only: boolean; strength_after?: boolean | null }[], dayIndex: number): StrengthSessionNumber | null {
  const order = [...days]
    .sort((a, b) => a.day_index - b.day_index)
    .filter((d) => (d.is_rest ? d.strength_only : d.strength_after === true))
    .map((d) => d.day_index);
  const i = order.indexOf(dayIndex);
  return i < 0 ? null : ((i % 2) + 1) as StrengthSessionNumber;
}

/** Problemas de una rutina (para el validador del contenido). */
export function checkStrengthRoutine(name: string, exercises: { session: number; pattern: string; exercise: string }[]): string[] {
  const problems: string[] = [];
  for (const s of [1, 2] as const) {
    const got = exercises.filter((e) => e.session === s).map((e) => e.pattern);
    const want = SESSION_PATTERNS[s];
    if (got.length !== 5) problems.push(`Rutina ${name}, sesión ${s}: tiene ${got.length} ejercicios (deben ser 5)`);
    if ([...got].sort().join() !== [...want].sort().join()) problems.push(`Rutina ${name}, sesión ${s}: patrones ${got.join(", ")} (se esperaban ${want.join(", ")})`);
  }
  const names = exercises.map((e) => e.exercise.toLowerCase());
  if (new Set(names).size !== names.length) problems.push(`Rutina ${name}: hay ejercicios repetidos`);
  return problems;
}
