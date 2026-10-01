import { DURATION_LIMITS, type PlanVersion, type PlanWeek } from "./model";

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface PlanValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** Carga planificada de una semana (suma de duraciones y distancias declaradas). */
export function plannedWeekLoad(week: PlanWeek): { durationS: number; distanceM: number } {
  return week.sessions.reduce(
    (acc, s) => ({
      durationS: acc.durationS + (s.type === "rest" ? 0 : (s.durationS ?? 0)),
      distanceM: acc.distanceM + (s.type === "rest" ? 0 : (s.distanceM ?? 0)),
    }),
    { durationS: 0, distanceM: 0 },
  );
}

/**
 * Valida estructuralmente una versión de plan. Las reglas son deterministas: no corrigen ni completan
 * datos, solo informan. Un plan con errores no puede publicarse.
 */
export function validatePlanVersion(plan: PlanVersion): PlanValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, message: string, path?: string) => errors.push({ code, message, path });
  const warn = (code: string, message: string, path?: string) =>
    warnings.push({ code, message, path });

  const limits = DURATION_LIMITS[plan.kind];
  if (plan.durationWeeks < limits.min || plan.durationWeeks > limits.max) {
    err(
      "duration_out_of_range",
      `La duración debe estar entre ${limits.min} y ${limits.max} semanas`,
      "durationWeeks",
    );
  }

  if (plan.weeks.length !== plan.durationWeeks) {
    err(
      "weeks_count_mismatch",
      `El plan declara ${plan.durationWeeks} semanas pero tiene ${plan.weeks.length} cargadas`,
      "weeks",
    );
  }

  const sortedWeeks = [...plan.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  sortedWeeks.forEach((w, i) => {
    if (w.weekNumber !== i + 1) {
      err("weeks_not_contiguous", `Las semanas deben numerarse 1..N sin huecos (falta la ${i + 1})`, "weeks");
    }
  });

  for (const week of sortedWeeks) {
    const wp = `weeks[${week.weekNumber}]`;
    if (week.sessions.length !== plan.sessionsPerWeek) {
      err(
        "sessions_per_week_mismatch",
        `Semana ${week.weekNumber}: tiene ${week.sessions.length} sesiones y el plan declara ${plan.sessionsPerWeek}`,
        wp,
      );
    }
    const slots = new Set<number>();
    const numbers = new Set<number>();
    for (const s of week.sessions) {
      const sp = `${wp}.sessions[${s.sessionNumber}]`;
      if (slots.has(s.daySlot)) err("duplicate_day_slot", `Semana ${week.weekNumber}: día ${s.daySlot} repetido`, sp);
      slots.add(s.daySlot);
      if (numbers.has(s.sessionNumber))
        err("duplicate_session_number", `Semana ${week.weekNumber}: sesión ${s.sessionNumber} repetida`, sp);
      numbers.add(s.sessionNumber);
      if (s.daySlot > plan.sessionsPerWeek)
        err("day_slot_out_of_range", `Semana ${week.weekNumber}: el día ${s.daySlot} excede las sesiones semanales`, sp);
      if (s.type !== "rest" && s.distanceM == null && s.durationS == null)
        err("session_without_volume", `Semana ${week.weekNumber}, sesión ${s.sessionNumber}: indicá distancia o duración`, sp);
      if (s.rpeMin != null && s.rpeMax != null && s.rpeMin > s.rpeMax)
        err("rpe_range_invalid", `Semana ${week.weekNumber}, sesión ${s.sessionNumber}: RPE mínimo mayor al máximo`, sp);
      if (s.type !== "rest" && !s.mainSet.trim())
        err("missing_main_set", `Semana ${week.weekNumber}, sesión ${s.sessionNumber}: falta la parte principal`, sp);
      if (["intervals", "tempo", "test"].includes(s.type) && (!s.warmup.trim() || !s.cooldown.trim()))
        warn("missing_warmup_cooldown", `Semana ${week.weekNumber}, sesión ${s.sessionNumber}: sesión intensa sin calentamiento o vuelta a la calma`, sp);
      if (s.rpeMax != null && s.rpeMax >= 8 && (s.intensity === "very_easy" || s.intensity === "easy"))
        warn("intensity_rpe_mismatch", `Semana ${week.weekNumber}, sesión ${s.sessionNumber}: intensidad suave con RPE alto`, sp);
    }
  }

  // Progresión de carga semanal (advertencia configurable, no bloqueante). Se compara contra el máximo
  // de las 3 semanas previas, para que una semana de descarga no dispare falsos positivos.
  const maxInc = plan.progressionRules.maxWeeklyLoadIncreasePct;
  for (let i = 1; i < sortedWeeks.length; i++) {
    const ref = Math.max(
      ...sortedWeeks.slice(Math.max(0, i - 3), i).map((w) => plannedWeekLoad(w).durationS),
    );
    const cur = plannedWeekLoad(sortedWeeks[i]!).durationS;
    if (ref > 0 && cur > ref * (1 + maxInc / 100)) {
      warn(
        "load_increase_above_rule",
        `Semana ${sortedWeeks[i]!.weekNumber}: la duración planificada sube ${Math.round(((cur - ref) / ref) * 100)}% (regla configurada: ${maxInc}%)`,
        `weeks[${sortedWeeks[i]!.weekNumber}]`,
      );
    }
  }

  if (plan.scheduleVariants.length === 0) {
    err("no_schedule_variants", "Definí al menos una variante de días validada", "scheduleVariants");
  }
  for (const v of plan.scheduleVariants) {
    for (const p of v.weekdayPatterns) {
      if (p.length !== plan.sessionsPerWeek)
        err("pattern_length_mismatch", `Variante ${v.id}: el patrón ${p.join(",")} no tiene ${plan.sessionsPerWeek} días`, "scheduleVariants");
      if (new Set(p).size !== p.length)
        err("pattern_duplicate_days", `Variante ${v.id}: días repetidos en ${p.join(",")}`, "scheduleVariants");
      if (p.some((d, i) => i > 0 && d <= p[i - 1]!))
        err("pattern_not_sorted", `Variante ${v.id}: los días deben estar ordenados de lunes a domingo`, "scheduleVariants");
    }
  }

  if (!plan.objective.trim()) err("missing_objective", "Falta el objetivo del plan", "objective");
  if (!plan.reduceOrStopCriteria.trim())
    err("missing_stop_criteria", "Faltan los criterios para reducir o suspender sesiones", "reduceOrStopCriteria");
  if (!plan.progressionCriteria.trim())
    err("missing_progression_criteria", "Faltan los criterios de progresión", "progressionCriteria");

  return { valid: errors.length === 0, errors, warnings };
}
