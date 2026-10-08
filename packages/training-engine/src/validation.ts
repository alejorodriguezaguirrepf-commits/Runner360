import { planVersionSchema, type PlanVersion, type PlanVersionInput, type Session } from "./schemas";

/**
 * Validación determinista de una versión de plan antes de publicarla.
 * Los errores bloquean la publicación; las advertencias se muestran al administrador.
 */

export type IssueSeverity = "error" | "warning";

export interface PlanIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  weekNumber?: number;
  sessionNumber?: number;
}

export const MIN_PLAN_WEEKS = 8;
export const MAX_PLAN_WEEKS = 24;

function sessionVolumeS(s: Session): number {
  // Volumen aproximado por duración; si solo hay distancia se estima a 6:00 min/km
  // únicamente para la comparación relativa entre semanas (no se muestra al usuario).
  if (s.durationS !== null) return s.durationS;
  if (s.distanceM !== null) return Math.round((s.distanceM / 1000) * 360);
  return 0;
}

export function validatePlanVersion(input: PlanVersionInput): { ok: boolean; issues: PlanIssue[]; version?: PlanVersion } {
  const parsed = planVersionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        severity: "error" as const,
        code: "SCHEMA",
        message: `${i.path.join(".") || "plan"}: ${i.message}`,
      })),
    };
  }
  const v = parsed.data;
  const issues: PlanIssue[] = [];
  const err = (code: string, message: string, extra: Partial<PlanIssue> = {}) =>
    issues.push({ severity: "error", code, message, ...extra });
  const warn = (code: string, message: string, extra: Partial<PlanIssue> = {}) =>
    issues.push({ severity: "warning", code, message, ...extra });

  if (v.durationWeeks < MIN_PLAN_WEEKS || v.durationWeeks > MAX_PLAN_WEEKS) {
    err("DURATION_OUT_OF_RANGE", `La duración debe estar entre ${MIN_PLAN_WEEKS} y ${MAX_PLAN_WEEKS} semanas`);
  }

  if (!v.isDemo && (!v.validatedBy || !v.validatedAt)) {
    err("NOT_VALIDATED", "Un plan que no es DEMO requiere validación profesional registrada antes de publicarse");
  }

  if (!v.objective.trim()) warn("MISSING_OBJECTIVE", "El plan no tiene objetivo descripto");

  // Semanas
  const weekNumbers = new Set(v.weeks.map((w) => w.weekNumber));
  for (let w = 1; w <= v.durationWeeks; w++) {
    if (!weekNumbers.has(w)) err("MISSING_WEEK", `Falta la semana ${w}`, { weekNumber: w });
  }
  for (const w of v.weeks) {
    if (w.weekNumber > v.durationWeeks) err("WEEK_OUT_OF_RANGE", `La semana ${w.weekNumber} excede la duración`, { weekNumber: w.weekNumber });
  }

  // Sesiones por semana
  const byWeek = new Map<number, Session[]>();
  for (const s of v.sessions) {
    const list = byWeek.get(s.weekNumber) ?? [];
    list.push(s);
    byWeek.set(s.weekNumber, list);
  }
  for (let w = 1; w <= v.durationWeeks; w++) {
    const list = byWeek.get(w) ?? [];
    const numbers = new Set(list.map((s) => s.sessionNumber));
    if (numbers.size !== list.length) err("DUPLICATE_SESSION", `Sesiones duplicadas en la semana ${w}`, { weekNumber: w });
    for (let n = 1; n <= v.sessionsPerWeek; n++) {
      if (!numbers.has(n)) err("MISSING_SESSION", `Falta la sesión ${n} de la semana ${w}`, { weekNumber: w, sessionNumber: n });
    }
    for (const s of list) {
      if (s.sessionNumber > v.sessionsPerWeek) {
        err("SESSION_OUT_OF_RANGE", `La sesión ${s.sessionNumber} excede las sesiones por semana`, { weekNumber: w, sessionNumber: s.sessionNumber });
      }
    }
  }
  for (const s of v.sessions) {
    if (s.weekNumber > v.durationWeeks) {
      err("SESSION_WEEK_OUT_OF_RANGE", `Sesión en la semana ${s.weekNumber}, fuera de la duración`, { weekNumber: s.weekNumber });
    }
    if (s.type === "rest") continue;
    const at = { weekNumber: s.weekNumber, sessionNumber: s.sessionNumber };
    if (!s.mainSet.trim()) err("MISSING_MAIN_SET", `Semana ${s.weekNumber}, sesión ${s.sessionNumber}: falta la parte principal`, at);
    if (!s.stopCriteria.trim()) err("MISSING_STOP_CRITERIA", `Semana ${s.weekNumber}, sesión ${s.sessionNumber}: faltan criterios para reducir o suspender`, at);
    if (s.type !== "strength" && !s.warmup.trim()) warn("MISSING_WARMUP", `Semana ${s.weekNumber}, sesión ${s.sessionNumber}: falta la entrada en calor`, at);
    if (s.type !== "strength" && !s.cooldown.trim()) warn("MISSING_COOLDOWN", `Semana ${s.weekNumber}, sesión ${s.sessionNumber}: falta la vuelta a la calma`, at);
    if (s.type === "intervals" || s.type === "tempo") {
      if (s.rpeMin === null || s.rpeMax === null) warn("MISSING_RPE", `Semana ${s.weekNumber}, sesión ${s.sessionNumber}: sesión de calidad sin RPE objetivo`, at);
    }
  }

  // Variantes de distribución
  if (v.scheduleVariants.length === 0) err("NO_VARIANTS", "El plan necesita al menos una variante de distribución semanal");
  const codes = new Set<string>();
  for (const variant of v.scheduleVariants) {
    if (codes.has(variant.code)) err("DUPLICATE_VARIANT", `Variante duplicada: ${variant.code}`);
    codes.add(variant.code);
    if (variant.weekdays.length !== v.sessionsPerWeek) {
      err("VARIANT_SIZE", `La variante ${variant.code} asigna ${variant.weekdays.length} días y el plan tiene ${v.sessionsPerWeek} sesiones`);
    }
  }

  // Reglas de semana inicial
  for (const rule of v.startWeekRules) {
    if (rule.startWeek > v.durationWeeks) err("START_RULE_RANGE", `Regla de inicio en semana ${rule.startWeek} fuera de la duración`);
  }

  // Progresión de volumen semanal (advertencia, no bloqueo). Se compara contra la mayor de las
  // dos semanas previas para no penalizar el regreso después de una semana de descarga.
  const maxInc = v.progressionRules.maxWeeklyVolumeIncreasePct / 100;
  const volumes: number[] = [];
  for (let w = 1; w <= v.durationWeeks; w++) {
    const vol = (byWeek.get(w) ?? []).reduce((acc, s) => acc + sessionVolumeS(s), 0);
    const ref = Math.max(volumes[w - 2] ?? 0, volumes[w - 3] ?? 0);
    if (ref > 0 && vol > ref * (1 + maxInc)) {
      warn("VOLUME_JUMP", `La semana ${w} aumenta el volumen más de ${v.progressionRules.maxWeeklyVolumeIncreasePct}% respecto de las semanas previas`, { weekNumber: w });
    }
    volumes.push(vol);
  }

  const ok = !issues.some((i) => i.severity === "error");
  return { ok, issues, version: v };
}
