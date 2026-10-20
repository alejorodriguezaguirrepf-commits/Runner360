/**
 * Reglas de calidad de los planes (además de los invariantes estructurales de invariants.ts).
 * Las usan la auditoría (scripts/audit-plans.ts) y el validador que corre en los tests.
 *
 *  1. Ninguna sesión de calidad se repite igual en semanas consecutivas.
 *  2. Toda pasada es de una distancia permitida (ALLOWED_REP_METERS).
 *  3. No hay trabajos de velocidad dosificados en segundos (ni repeticiones por tiempo).
 *  4. Por distancia: intermedio con más volumen que principiante; y ningún intermedio por encima
 *     del avanzado.
 *  5. La parte principal se expresa en distancia: sin tramos de carrera en minutos (las pausas de
 *     recuperación sí pueden ir en tiempo).
 */
import { isSession } from "./invariants";
import type { Library, LibraryPlan, LibrarySessionDay } from "./schema";

export const ALLOWED_REP_METERS = [100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000, 5000] as const;

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const TIME = String.raw`(?:\d+h\d{2}'|\d+'(?:\d{2}")?|\d+")`;

const toNumber = (s: string) => Number(s.replace(",", "."));

/** Pasadas "N × D m|km" (también "N × (D m trote + …)"), con D en metros. */
export function repDistances(text: string): { n: number; meters: number; raw: string }[] {
  const re = new RegExp(String.raw`(\d+)\s*×\s*\(?\s*${NUM}\s*(km|m)\b`, "g");
  return [...text.matchAll(re)].map((m) => ({
    n: Number(m[1]),
    meters: Math.round(toNumber(m[2]!) * (m[3] === "km" ? 1000 : 1)),
    raw: m[0],
  }));
}

/** Repeticiones dosificadas por tiempo ("8 × 20\"", "3 × 8'", "8 × (1' trote …"). */
export function timedReps(text: string): { raw: string; seconds: boolean }[] {
  const re = new RegExp(String.raw`(\d+)\s*×\s*\(?\s*(${TIME})`, "g");
  return [...text.matchAll(re)].map((m) => ({ raw: m[0], seconds: /^\d+"$/.test(m[2]!) }));
}

/** Frases de recuperación permitidas en tiempo (se quitan antes de buscar carrera en minutos). */
const RECOVERY = [
  new RegExp(String.raw`pausa\s+${TIME}(\s+de\s+(trote|caminata)[^,;)]*)?`, "g"),
  new RegExp(String.raw`con\s+${TIME}\s+de\s+(trote|caminata)[^,;)]*`, "g"),
  new RegExp(String.raw`\+\s*${TIME}\s+(de\s+)?caminata[^,;)]*`, "g"),
  new RegExp(String.raw`${TIME}\s+de\s+(trote|caminata)\s+suave\s+entre[^,;)]*`, "g"),
];

/** Tramos de carrera expresados en tiempo dentro de la parte principal (debería ir en km). */
export function timedRunning(mainSet: string): string[] {
  let t = mainSet;
  for (const re of RECOVERY) t = t.replace(re, "");
  return [...t.matchAll(new RegExp(TIME, "g"))].map((m) => m[0]);
}

const qualities = (plan: LibraryPlan, weekIndex: number): LibrarySessionDay[] =>
  plan.weeks[weekIndex]!.days.filter(isSession).filter((d) => d.is_quality && d.category !== "race");

/** Pares de semanas consecutivas con una sesión de calidad idéntica. */
export function repeatedQuality(plan: LibraryPlan): { week: number; mainSet: string }[] {
  const out: { week: number; mainSet: string }[] = [];
  for (let i = 1; i < plan.weeks.length; i++) {
    const prev = new Set(qualities(plan, i - 1).map((d) => d.main_set));
    for (const d of qualities(plan, i)) if (prev.has(d.main_set)) out.push({ week: plan.weeks[i]!.week, mainSet: d.main_set });
  }
  return out;
}

/** Km semanales promedio de un plan. */
export function averageWeeklyKm(plan: LibraryPlan): number {
  return plan.weeks.reduce((a, w) => a + w.totals.distance_km_est, 0) / plan.weeks.length;
}

const LEVEL_RANK = { Principiante: 0, Intermedio: 1, Avanzado: 2 } as const;

/**
 * Orden de volumen entre niveles. Con la misma distancia y días por semana, el intermedio tiene más
 * km semanales promedio que el principiante; y ningún intermedio supera el promedio de ningún
 * avanzado.
 */
export function levelVolumeProblems(plans: LibraryPlan[]): string[] {
  const problems: string[] = [];
  for (const a of plans)
    for (const b of plans) {
      if (a.distance_km !== b.distance_km || a.days_per_week !== b.days_per_week) continue;
      if (LEVEL_RANK[a.level] < LEVEL_RANK[b.level] && averageWeeklyKm(a) >= averageWeeklyKm(b))
        problems.push(`${b.id} (${b.level}) no tiene más volumen que ${a.id} (${a.level})`);
    }
  const intermediates = plans.filter((p) => p.level === "Intermedio");
  const advanced = plans.filter((p) => p.level === "Avanzado");
  for (const i of intermediates)
    for (const a of advanced)
      if (averageWeeklyKm(i) > averageWeeklyKm(a)) problems.push(`${i.id} (Intermedio) supera el volumen de ${a.id} (Avanzado)`);
  return problems;
}

/** Todas las violaciones de las reglas de calidad. Vacío = OK. */
export function checkQualityRules(lib: Library): string[] {
  const errors: string[] = [];
  const allowed = new Set<number>(ALLOWED_REP_METERS);
  for (const plan of lib.plans) {
    for (const r of repeatedQuality(plan)) errors.push(`${plan.id} semana ${r.week}: sesión de calidad igual a la semana anterior («${r.mainSet}»)`);
    for (const week of plan.weeks)
      for (const d of week.days.filter(isSession)) {
        const where = `${plan.id} semana ${week.week} ${d.day}`;
        for (const field of ["warmup", "main_set", "cooldown"] as const) {
          for (const r of repDistances(d[field])) if (!allowed.has(r.meters)) errors.push(`${where}: pasada de ${r.meters} m fuera de la lista («${r.raw}»)`);
          for (const r of timedReps(d[field])) errors.push(`${where}: ${r.seconds ? "velocidad en segundos" : "repeticiones por tiempo"} («${r.raw}»)`);
        }
        for (const t of timedRunning(d.main_set)) errors.push(`${where}: parte principal en tiempo (${t}) en lugar de km`);
      }
  }
  errors.push(...levelVolumeProblems(lib.plans));
  return errors;
}
