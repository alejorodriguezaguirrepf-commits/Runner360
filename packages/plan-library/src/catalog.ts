import { raceWeekOf } from "./invariants";
import { LEVELS, type Level, type LibraryPlan } from "./schema";

/** Ficha de un plan tal como está en library_plans (sin semanas). */
export type CatalogPlan = Omit<LibraryPlan, "weeks" | "distance"> & { distance_label: string; race_week: number };

export function toCatalogPlan(plan: LibraryPlan): CatalogPlan {
  const { weeks: _weeks, distance, ...rest } = plan;
  return { ...rest, distance_label: distance, race_week: raceWeekOf(plan) ?? plan.duration_weeks };
}

// ---------------------------------------------------------------- Selector de planes
/** Orden de los pasos: distancia (pestañas) → días por semana → duración → nivel. */
export type CatalogFilter = { distanceKm?: number; daysPerWeek?: number; durationWeeks?: number; level?: Level };

type PlanSummary = Pick<LibraryPlan, "id" | "distance_km" | "level" | "duration_weeks" | "days_per_week">;

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * Opciones de cada paso según lo elegido en los anteriores. Si un paso tiene una sola opción se
 * elige sola (por ejemplo, los días de 21 y 42 km o el nivel de cada distancia).
 * Un valor que no existe para lo ya elegido se descarta.
 */
export function catalogSteps<P extends PlanSummary>(plans: P[], filter: CatalogFilter) {
  const distances = uniq(plans.map((p) => p.distance_km)).sort((a, b) => a - b);
  const pick = <T,>(options: T[], value: T | undefined, enabled: boolean): T | undefined =>
    !enabled ? undefined : value !== undefined && options.includes(value) ? value : options.length === 1 ? options[0] : undefined;

  const distanceKm = pick(distances, filter.distanceKm, true);
  const byDistance = plans.filter((p) => p.distance_km === distanceKm);

  const days = uniq(byDistance.map((p) => p.days_per_week)).sort((a, b) => a - b);
  const daysPerWeek = pick(days, filter.daysPerWeek, distanceKm !== undefined);
  const byDays = byDistance.filter((p) => p.days_per_week === daysPerWeek);

  // Duraciones de menor a mayor nivel (Principiante antes que Intermedio) y, dentro del nivel, por semanas.
  const levelRank = (w: number) => Math.min(...byDays.filter((p) => p.duration_weeks === w).map((p) => LEVELS.indexOf(p.level)));
  const durations = uniq(byDays.map((p) => p.duration_weeks)).sort((a, b) => levelRank(a) - levelRank(b) || a - b);
  const durationWeeks = pick(durations, filter.durationWeeks, daysPerWeek !== undefined);
  const byDuration = byDays.filter((p) => p.duration_weeks === durationWeeks);

  const levels = uniq(byDuration.map((p) => p.level));
  const level = pick(levels, filter.level, durationWeeks !== undefined);
  const results = byDuration.filter((p) => p.level === level);

  return {
    filter: { distanceKm, daysPerWeek, durationWeeks, level } satisfies CatalogFilter,
    options: {
      distances,
      days: distanceKm === undefined ? [] : days,
      durations: daysPerWeek === undefined ? [] : durations,
      levels: durationWeeks === undefined ? [] : levels,
    },
    /** Nivel de cada duración cuando la distancia tiene más de un nivel (para rotular las opciones). */
    durationLevel: (w: number): Level | undefined =>
      uniq(byDistance.map((p) => p.level)).length > 1 ? byDays.find((p) => p.duration_weeks === w)?.level : undefined,
    /** El plan elegido: solo cuando los cuatro pasos quedaron definidos. */
    plan: results.length === 1 ? results[0]! : null,
  };
}
