import { daysBetween } from "./dates";
import type { LoadSignal, SessionCategory } from "./schema";

/**
 * Motor de reglas de carga. Declarativo: cada regla tiene un id, la fuente del contenido que la
 * respalda (load_monitoring o practical_rules), una condición y una acción. El mensaje que ve la
 * persona es SIEMPRE el texto del contenido (no se reescribe). El motor recomienda; la persona
 * confirma en el check-in y la decisión queda registrada.
 */

export type LoadDecision = "advance" | "repeat" | "reduce" | "regress" | "pause";
/** Orden de prioridad: si dos reglas se disparan, gana la más conservadora. */
const PRIORITY: LoadDecision[] = ["advance", "repeat", "reduce", "regress", "pause"];

export type RuleSource =
  | { kind: "load_monitoring"; signal: string; field: "continue" | "reduce_or_repeat" | "stop_and_consult" }
  | { kind: "practical_rule"; startsWith: string };

export type RedFlag = "limp" | "bone_pain" | "swelling" | "night_pain";

export type SessionLog = {
  date: string;
  planDayIndex: number;
  status: "completed" | "modified" | "skipped";
  rpe: number | null;
  pain: number | null;
  redFlags: RedFlag[];
  sleep: "good" | "fair" | "poor" | null;
  /** Categoría del día del plan registrado (para "RPE de los rodajes Suaves"). */
  category: SessionCategory | null;
};

export type PlannedSession = { date: string; dayIndex: number; category: SessionCategory; isQuality: boolean };

export type WeekContext = {
  today: string;
  weekStart: string;
  planWeek: number;
  planned: PlannedSession[];
  logs: SessionLog[];
  /** Respuesta al criterio de progresión de la semana (null = todavía no respondió). */
  criterionMet: boolean | null;
  /** Si la semana anterior tampoco cumplió el criterio. */
  previousCriterionMet: boolean | null;
  /** Última fecha con un entrenamiento registrado (de cualquier semana), o null. */
  lastTrainingDate: string | null;
  /** Semanas de descarga del plan (week_type que empieza con "D"), para "volver a la última descarga". */
  deloadWeeks: number[];
};

export type RuleHit = {
  id: RuleId;
  recommendation: LoadDecision | null;
  /** Semana a la que se sugiere volver (regress). */
  regressTo?: number;
  source: RuleSource;
};

type Rule = {
  id: RuleId;
  source: RuleSource;
  /** null = no aplica; si aplica, la acción (o null si solo informa). */
  when: (c: WeekContext) => { recommendation: LoadDecision | null; regressTo?: number } | null;
};

export type RuleId =
  | "pain_stop"
  | "pain_reduce"
  | "easy_rpe_high"
  | "poor_sleep"
  | "missed_one"
  | "missed_two"
  | "missed_week"
  | "two_weeks_off"
  | "criterion_twice";

const EASY: SessionCategory[] = ["rec", "easy"];

/** Sesiones del plan con fecha pasada (o de hoy registrada) que no se hicieron. */
export function missedSessions(c: Pick<WeekContext, "planned" | "logs" | "today">): PlannedSession[] {
  return c.planned.filter((p) => {
    const log = c.logs.find((l) => l.planDayIndex === p.dayIndex);
    if (log) return log.status === "skipped";
    return p.date < c.today;
  });
}

function consecutivePoorNights(logs: SessionLog[]): boolean {
  const sorted = [...logs].filter((l) => l.sleep !== null).sort((a, b) => a.date.localeCompare(b.date));
  return sorted.some((l, i) => i > 0 && l.sleep === "poor" && sorted[i - 1]!.sleep === "poor" && daysBetween(sorted[i - 1]!.date, l.date) <= 1);
}

export const RULES: readonly Rule[] = [
  {
    id: "pain_stop",
    source: { kind: "load_monitoring", signal: "Dolor (0–10)", field: "stop_and_consult" },
    when: (c) => (c.logs.some((l) => (l.pain ?? 0) > 5 || l.redFlags.length > 0) ? { recommendation: "pause" } : null),
  },
  {
    id: "pain_reduce",
    source: { kind: "load_monitoring", signal: "Dolor (0–10)", field: "reduce_or_repeat" },
    when: (c) => (c.logs.some((l) => (l.pain ?? 0) >= 3 && (l.pain ?? 0) <= 5) ? { recommendation: "reduce" } : null),
  },
  {
    id: "easy_rpe_high",
    source: { kind: "load_monitoring", signal: "RPE de los rodajes Suaves", field: "reduce_or_repeat" },
    // "De forma habitual": al menos dos rodajes Suaves (o de recuperación) de la semana con RPE ≥ 5.
    when: (c) => (c.logs.filter((l) => l.category && EASY.includes(l.category) && l.status !== "skipped" && (l.rpe ?? 0) >= 5).length >= 2 ? { recommendation: "repeat" } : null),
  },
  {
    id: "poor_sleep",
    source: { kind: "load_monitoring", signal: "Sueño", field: "reduce_or_repeat" },
    when: (c) => (consecutivePoorNights(c.logs) ? { recommendation: null } : null),
  },
  {
    id: "missed_one",
    source: { kind: "practical_rule", startsWith: "Sesión perdida" },
    when: (c) => (missedSessions(c).length === 1 ? { recommendation: null } : null),
  },
  {
    id: "missed_two",
    source: { kind: "practical_rule", startsWith: "Dos o más sesiones perdidas" },
    when: (c) => (missedSessions(c).length >= 2 ? { recommendation: "repeat" } : null),
  },
  {
    id: "missed_week",
    source: { kind: "practical_rule", startsWith: "Una semana perdida" },
    when: (c) => {
      const gap = c.lastTrainingDate ? daysBetween(c.lastTrainingDate, c.today) : null;
      return gap !== null && gap >= 7 && gap < 14 ? { recommendation: "regress", regressTo: Math.max(1, c.planWeek - 1) } : null;
    },
  },
  {
    id: "two_weeks_off",
    source: { kind: "practical_rule", startsWith: "Dos semanas o más sin entrenar" },
    when: (c) => {
      const gap = c.lastTrainingDate ? daysBetween(c.lastTrainingDate, c.today) : null;
      if (gap === null || gap < 14) return null;
      // "retroceder al menos dos semanas, o volver a la última semana de descarga": la más conservadora.
      const lastDeload = [...c.deloadWeeks].filter((w) => w < c.planWeek).pop();
      const back2 = Math.max(1, c.planWeek - 2);
      return { recommendation: "regress", regressTo: lastDeload !== undefined ? Math.min(back2, lastDeload) : back2 };
    },
  },
  {
    id: "criterion_twice",
    source: { kind: "practical_rule", startsWith: "Si la persona no cumple el criterio de progresión dos semanas seguidas" },
    when: (c) => {
      if (c.criterionMet !== false || c.previousCriterionMet !== false) return null;
      const lastDeload = [...c.deloadWeeks].filter((w) => w < c.planWeek).pop();
      return lastDeload !== undefined ? { recommendation: "regress", regressTo: lastDeload } : { recommendation: "repeat" };
    },
  },
];

export type WeekEvaluation = { recommendation: LoadDecision; regressTo: number | null; hits: RuleHit[] };

/**
 * Recomendación para el check-in semanal. Sin reglas disparadas: si cumplió el criterio, avanzar;
 * si no lo cumplió, repetir la semana (practical_rules: no se sube la carga sin cumplir el criterio).
 */
export function evaluateWeek(c: WeekContext): WeekEvaluation {
  const hits: RuleHit[] = [];
  for (const r of RULES) {
    const res = r.when(c);
    if (res) hits.push({ id: r.id, recommendation: res.recommendation, ...(res.regressTo !== undefined ? { regressTo: res.regressTo } : {}), source: r.source });
  }
  let rec: LoadDecision = c.criterionMet === false ? "repeat" : "advance";
  let regressTo: number | null = null;
  for (const h of hits) {
    if (h.recommendation && PRIORITY.indexOf(h.recommendation) > PRIORITY.indexOf(rec)) {
      rec = h.recommendation;
      regressTo = h.regressTo ?? null;
    } else if (h.recommendation === "regress" && rec === "regress" && h.regressTo !== undefined) {
      regressTo = Math.min(regressTo ?? h.regressTo, h.regressTo);
    }
  }
  return { recommendation: rec, regressTo, hits };
}

/** Reglas que se evalúan apenas se registra una sesión (dolor > 5 o señales de alarma → pausa). */
export function evaluateLog(log: SessionLog): RuleHit[] {
  const c: WeekContext = {
    today: log.date,
    weekStart: log.date,
    planWeek: 1,
    planned: [],
    logs: [log],
    criterionMet: null,
    previousCriterionMet: null,
    lastTrainingDate: log.date,
    deloadWeeks: [],
  };
  return RULES.filter((r) => r.id === "pain_stop" || r.id === "pain_reduce")
    .map((r) => ({ r, res: r.when(c) }))
    .filter((x) => x.res)
    .map(({ r, res }) => ({ id: r.id, recommendation: res!.recommendation, source: r.source }));
}

/** Texto del contenido que respalda una regla (o null si el contenido cambió y ya no está). */
export function ruleText(source: RuleSource, content: { load_monitoring: LoadSignal[]; practical_rules: string[] }): string | null {
  if (source.kind === "load_monitoring") {
    const row = content.load_monitoring.find((s) => s.signal === source.signal);
    if (!row) return null;
    return `${row.signal}: ${row[source.field]}`;
  }
  return content.practical_rules.find((r) => r.startsWith(source.startsWith)) ?? null;
}

/** Próxima semana del plan según la decisión del check-in. */
export function nextPlanWeek(decision: Exclude<LoadDecision, "pause">, planWeek: number, regressTo: number | null): number {
  switch (decision) {
    case "advance":
      return planWeek + 1;
    case "repeat":
    case "reduce":
      return planWeek;
    case "regress":
      return Math.max(1, regressTo ?? planWeek - 1);
  }
}

/** Decisiones que se le ofrecen a la persona según la recomendación. Con "pausa" solo se puede pausar. */
export function allowedDecisions(rec: LoadDecision): LoadDecision[] {
  if (rec === "pause") return ["pause"];
  if (rec === "advance") return ["advance", "repeat", "reduce"];
  // Con una recomendación conservadora no se ofrece avanzar: se elige entre las opciones conservadoras.
  if (rec === "regress") return ["regress", "repeat", "reduce"];
  return [rec, ...(["repeat", "reduce"] as LoadDecision[]).filter((d) => d !== rec)];
}

/** Semana en que se retoma después de una pausa, según cuánto tiempo pasó sin entrenar. */
export function resumeWeek(planWeek: number, lastTrainingDate: string | null, today: string, deloadWeeks: number[]): number {
  const gap = lastTrainingDate ? daysBetween(lastTrainingDate, today) : 0;
  if (gap >= 14) {
    const lastDeload = [...deloadWeeks].filter((w) => w < planWeek).pop();
    const back2 = Math.max(1, planWeek - 2);
    return lastDeload !== undefined ? Math.min(back2, lastDeload) : back2;
  }
  if (gap >= 7) return Math.max(1, planWeek - 1);
  return planWeek;
}

