import { earliestStart, raceDateFromStart, timingForRace } from "./dates";
import { assessPlan, type Assessment, type RequirementCheck } from "./requirements";
import { raceWeekOf } from "./invariants";
import type { Level, LibraryPlan } from "./schema";

/** Ficha de un plan tal como está en library_plans (sin semanas). */
export type CatalogPlan = Omit<LibraryPlan, "weeks" | "distance"> & { distance_label: string; race_week: number };

export function toCatalogPlan(plan: LibraryPlan): CatalogPlan {
  const { weeks: _weeks, distance, ...rest } = plan;
  return { ...rest, distance_label: distance, race_week: raceWeekOf(plan) ?? plan.duration_weeks };
}

// ---------------------------------------------------------------- Filtros del catálogo
/** Orden de los filtros: distancia → nivel → duración → días por semana. */
export type CatalogFilter = { distanceKm?: number; level?: Level; durationWeeks?: number; daysPerWeek?: number };

type PlanSummary = Pick<LibraryPlan, "id" | "distance_km" | "level" | "duration_weeks" | "days_per_week">;

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * Opciones de cada paso según lo elegido en los anteriores. Si un paso tiene una sola opción se
 * elige sola (por ejemplo, el nivel de cada distancia), para llegar al plan en 4 toques como máximo.
 */
export function catalogSteps<P extends PlanSummary>(plans: P[], filter: CatalogFilter) {
  const f: CatalogFilter = { ...filter };
  const distances = uniq(plans.map((p) => p.distance_km)).sort((a, b) => a - b);
  if (f.distanceKm === undefined && distances.length === 1) f.distanceKm = distances[0];
  const byDistance = plans.filter((p) => f.distanceKm === undefined || p.distance_km === f.distanceKm);

  const levels = uniq(byDistance.map((p) => p.level));
  if (f.distanceKm !== undefined && f.level === undefined && levels.length === 1) f.level = levels[0];
  const byLevel = byDistance.filter((p) => f.level === undefined || p.level === f.level);

  const durations = uniq(byLevel.map((p) => p.duration_weeks)).sort((a, b) => a - b);
  if (f.level !== undefined && f.durationWeeks === undefined && durations.length === 1) f.durationWeeks = durations[0];
  const byDuration = byLevel.filter((p) => f.durationWeeks === undefined || p.duration_weeks === f.durationWeeks);

  const days = uniq(byDuration.map((p) => p.days_per_week)).sort((a, b) => a - b);
  if (f.durationWeeks !== undefined && f.daysPerWeek === undefined && days.length === 1) f.daysPerWeek = days[0];
  const results = byDuration.filter((p) => f.daysPerWeek === undefined || p.days_per_week === f.daysPerWeek);

  return {
    filter: f,
    options: { distances, levels: f.distanceKm === undefined ? [] : levels, durations: f.level === undefined ? [] : durations, days: f.durationWeeks === undefined ? [] : days },
    results,
  };
}

// ---------------------------------------------------------------- Recomendación
export type AssessedPlan = { plan: CatalogPlan; checks: RequirementCheck[]; eligible: boolean };

export type Recommendation =
  | {
      kind: "recommended";
      plan: CatalogPlan;
      checks: RequirementCheck[];
      startDate: string;
      raceDate: string;
      /** Textos del contenido a mostrar con la recomendación. */
      contentNotes: string[];
    }
  | {
      kind: "blocked";
      reason: "active_injury" | "medical_check" | "requirements" | "race_too_soon" | "no_plans";
      assessed: AssessedPlan[];
      /** Plan alternativo que indica el contenido (más largo / fase previa), si existe. */
      alternative: { plan: CatalogPlan; earliestRaceDate: string } | null;
      contentNotes: string[];
    };

/** Notas del plan que explican qué hacer si no se cumple un requisito (texto del contenido). */
export function fallbackNotes(plan: Pick<CatalogPlan, "notes">): string[] {
  return plan.notes.filter((n) => /^si la persona no cumple/i.test(n));
}

/**
 * Recomienda un plan de la distancia elegida comparando la evaluación inicial con los requisitos
 * de ingreso (incluido min_weekly_km). Nunca recomienda un plan cuyos requisitos no se cumplen.
 * Criterio conservador: entre los planes posibles, el de mayor duración (progresión más gradual);
 * con antecedentes de lesiones por sobrecarga, la frecuencia más baja posible.
 */
export function recommendPlan(input: {
  plans: CatalogPlan[];
  distanceKm: number;
  assessment: Assessment;
  today: string;
  /** Texto de individual_adaptation para "Volumen actual menor que el requisito", si existe. */
  lowVolumeAdaptation?: string | null;
}): Recommendation {
  const { assessment: a, today } = input;
  const candidates = input.plans.filter((p) => p.distance_km === input.distanceKm);
  const assessed: AssessedPlan[] = candidates.map((p) => assessPlan(p, a, { today }));
  const blocked = (reason: Extract<Recommendation, { kind: "blocked" }>["reason"], alternative: AssessedPlan | null, notes: string[] = []): Recommendation => ({
    kind: "blocked",
    reason,
    assessed,
    alternative: alternative ? { plan: alternative.plan, earliestRaceDate: raceDateFromStart(earliestStart(today), raceWeek(alternative.plan)) } : null,
    contentNotes: notes,
  });

  if (candidates.length === 0) return blocked("no_plans", null);
  if (a.activeInjury) return blocked("active_injury", null);
  if (a.healthFlag && !a.medicalClearance) return blocked("medical_check", null);

  const byDays = (xs: AssessedPlan[]) => {
    const fits = xs.filter((x) => x.plan.days_per_week <= a.daysAvailable);
    if (fits.length === 0) return [];
    const daysOptions = uniq(fits.map((x) => x.plan.days_per_week));
    const chosen = a.overuseInjuryHistory ? Math.min(...daysOptions) : Math.max(...daysOptions);
    return fits.filter((x) => x.plan.days_per_week === chosen);
  };
  const longestFirst = (xs: AssessedPlan[]) => [...xs].sort((x, y) => y.plan.duration_weeks - x.plan.duration_weeks);

  const eligible = byDays(assessed.filter((x) => x.eligible));
  const timed = eligible.map((x) => ({
    x,
    timing: a.raceDate ? timingForRace(a.raceDate, raceWeek(x.plan), today) : null,
  }));
  const fitting = longestFirst(timed.filter((t) => !t.timing || t.timing.ok).map((t) => t.x));
  const pick = fitting[0];
  if (pick) {
    const t = a.raceDate ? timingForRace(a.raceDate, raceWeek(pick.plan), today) : null;
    const startDate = t && t.ok ? t.startDate : earliestStart(today);
    return {
      kind: "recommended",
      plan: pick.plan,
      checks: pick.checks,
      startDate,
      raceDate: t && t.ok ? t.raceDate : raceDateFromStart(startDate, raceWeek(pick.plan)),
      contentNotes: [],
    };
  }

  if (eligible.length > 0) {
    // Cumple requisitos, pero la carrera es muy pronto: el plan más corto posible y su primera fecha.
    const shortest = [...eligible].sort((x, y) => x.plan.duration_weeks - y.plan.duration_weeks)[0]!;
    const notes = uniq(byDays(assessed.filter((x) => !x.eligible)).flatMap((x) => fallbackNotes(x.plan)));
    return blocked("race_too_soon", shortest, notes);
  }

  // No cumple los requisitos de ningún plan de su frecuencia: lo que indica el contenido.
  const sameDays = byDays(assessed);
  const notes = uniq(sameDays.flatMap((x) => fallbackNotes(x.plan)));
  const lowVolume = sameDays.some((x) => x.checks.some((c) => c.status === "unmet" && c.requirement.kind === "weekly_volume"));
  if (lowVolume && input.lowVolumeAdaptation) notes.push(input.lowVolumeAdaptation);
  const longest = longestFirst(sameDays)[0] ?? null;
  return blocked("requirements", longest && longest.eligible ? longest : null, notes);
}

const raceWeek = (plan: CatalogPlan) => plan.race_week;
