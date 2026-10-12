import type { Library, LibraryDay, LibraryPlan, LibrarySessionDay } from "./schema";
import { DAY_LABELS } from "./schema";

/** Cantidad de planes que trae la biblioteca. Si cambia, es un cambio de contenido deliberado. */
export const EXPECTED_PLAN_COUNT = 18;
/** Tolerancia para comparar la suma de km del calendario con los totales semanales. */
export const KM_TOLERANCE = 0.1;
/** Tolerancia (minutos) para comparar la suma de minutos con los totales semanales. */
export const MINUTES_TOLERANCE = 0.5;
/** Tipo de semana de la competencia objetivo. */
export const RACE_WEEK_TYPE = "RACE";

export function isSession(day: LibraryDay): day is LibrarySessionDay {
  return !day.is_rest;
}

/**
 * Sesión exigente: de calidad o de categoría Umbral, Intenso o Competencia.
 * Entre dos exigentes tiene que quedar al menos un día fácil o de descanso (practical_rules).
 */
export function isDemanding(day: LibraryDay): boolean {
  return isSession(day) && (day.is_quality || day.category === "thr" || day.category === "hard" || day.category === "race");
}

/** Semana de la competencia objetivo (la marcada RACE; no siempre es la última: ver plan 18). */
export function raceWeekOf(plan: LibraryPlan): number | null {
  const weeks = plan.weeks.filter((w) => w.week_type === RACE_WEEK_TYPE);
  return weeks.length === 1 ? weeks[0]!.week : null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Controla los invariantes del contenido. Devuelve la lista de problemas (vacía = OK).
 * El importador aborta si hay al menos uno.
 */
export function checkInvariants(lib: Library): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

  if (lib.plans.length !== EXPECTED_PLAN_COUNT) err("plans", `se esperaban ${EXPECTED_PLAN_COUNT} planes y hay ${lib.plans.length}`);

  const ids = new Set<string>();
  const numbers = new Set<number>();
  const sessionCodes = new Set(lib.session_catalog.map((s) => s.code));
  const intensityNames = new Set(lib.intensity_scale.map((i) => i.name));
  for (const name of Object.keys(lib.zone_map)) if (!intensityNames.has(name)) err("zone_map", `intensidad desconocida "${name}"`);

  for (const plan of lib.plans) {
    const p = plan.id;
    if (ids.has(p)) err(p, "id repetido");
    ids.add(p);
    if (numbers.has(plan.number)) err(p, `número ${plan.number} repetido`);
    numbers.add(plan.number);
    if (p !== `plan-${String(plan.number).padStart(2, "0")}`) err(p, `el id no coincide con el número ${plan.number}`);

    if (plan.weeks.length !== plan.duration_weeks) err(p, `tiene ${plan.weeks.length} semanas y duration_weeks = ${plan.duration_weeks}`);
    if (raceWeekOf(plan) === null) err(p, `debe tener exactamente una semana ${RACE_WEEK_TYPE}`);

    let previous: LibraryDay | null = null;
    plan.weeks.forEach((week, i) => {
      const w = `${p} semana ${week.week}`;
      if (week.week !== i + 1) err(w, `número de semana fuera de orden (posición ${i + 1})`);
      if (week.days.length !== 7) err(w, `tiene ${week.days.length} días (deben ser 7)`);
      week.days.forEach((day, j) => {
        if (day.day_index !== j) err(w, `day_index ${day.day_index} en la posición ${j}`);
        if (day.day !== DAY_LABELS[j]) err(w, `el día ${j} se llama "${day.day}" (se esperaba "${DAY_LABELS[j]}")`);
        if (isSession(day)) {
          if (!sessionCodes.has(day.code)) err(w, `código de sesión desconocido "${day.code}"`);
          for (const name of Object.keys(day.minutes_by_intensity)) {
            if (!intensityNames.has(name)) err(w, `intensidad desconocida "${name}" en ${day.day}`);
          }
        }
        if (previous && isDemanding(previous) && isDemanding(day)) err(w, `dos sesiones exigentes seguidas (${previous.day} y ${day.day})`);
        previous = day;
      });

      const sessions = week.days.filter(isSession);
      if (sessions.length !== plan.days_per_week) err(w, `tiene ${sessions.length} sesiones de carrera y days_per_week = ${plan.days_per_week}`);
      if (sessions.length !== week.totals.running_sessions) err(w, `totals.running_sessions = ${week.totals.running_sessions} y hay ${sessions.length} sesiones`);

      const km = sessions.reduce((s, d) => s + d.distance_km_est, 0);
      if (Math.abs(km - week.totals.distance_km_est) > KM_TOLERANCE) {
        err(w, `suma de km ${round2(km)} ≠ totals.distance_km_est ${week.totals.distance_km_est}`);
      }
      const min = sessions.reduce((s, d) => s + d.duration_min_est, 0);
      if (Math.abs(min - week.totals.duration_min_est) > MINUTES_TOLERANCE) {
        err(w, `suma de minutos ${round2(min)} ≠ totals.duration_min_est ${week.totals.duration_min_est}`);
      }
      const race = sessions.some((d) => d.category === "race");
      if (race !== week.totals.includes_race) err(w, `includes_race = ${week.totals.includes_race} y la semana ${race ? "tiene" : "no tiene"} competencia`);
    });
  }
  return errors;
}

/** Totales por plan: base del test golden. */
export function planTotals(plan: LibraryPlan) {
  const sessions = plan.weeks.flatMap((w) => w.days.filter(isSession));
  return {
    id: plan.id,
    weeks: plan.weeks.length,
    sessions: sessions.length,
    distanceKm: round2(sessions.reduce((s, d) => s + d.distance_km_est, 0)),
    durationMin: round2(sessions.reduce((s, d) => s + d.duration_min_est, 0)),
    raceWeek: raceWeekOf(plan),
  };
}
