import { strengthDose, strengthSessionOf, type StrengthDose, type StrengthLevel, type StrengthSessionNumber } from "@runner360/plan-library";
import type { DayRow, StrengthExercise, WeekRow } from "@/lib/data/library";

/** Lo que corresponde hacer de fuerza en un día (o en una sesión de la semana). */
export type StrengthPrescription = {
  routine: StrengthLevel;
  session: StrengthSessionNumber;
  /** null en el contenido anterior a 2026.13 (rutina única con series fijas). */
  dose: StrengthDose | null;
  exercises: StrengthExercise[];
};

type WeekContext = {
  exercises: StrengthExercise[];
  routine: StrengthLevel;
  days: Pick<DayRow, "day_index" | "is_rest" | "strength_only" | "strength_after">[];
  week: Pick<WeekRow, "week" | "week_type"> | null;
  totalWeeks: number;
};

/** Sesión de fuerza (con su dosis de esta semana) que corresponde a un día, o null si ese día no tiene fuerza. */
export function strengthForDay(ctx: WeekContext, dayIndex: number): StrengthPrescription | null {
  const session = strengthSessionOf(ctx.days, dayIndex);
  if (!session) return null;
  return strengthSession(ctx, session);
}

export function strengthSession(ctx: Omit<WeekContext, "days">, session: StrengthSessionNumber): StrengthPrescription | null {
  const all = ctx.exercises.filter((e) => e.routine === ctx.routine);
  if (!all.length) return null;
  const legacy = all.every((e) => e.pattern === null);
  if (legacy) return { routine: ctx.routine, session: 1, dose: null, exercises: all };
  const exercises = all.filter((e) => e.session === session);
  const dose = ctx.week ? strengthDose({ weekType: ctx.week.week_type, week: ctx.week.week, totalWeeks: ctx.totalWeeks, session, level: ctx.routine }) : null;
  return { routine: ctx.routine, session, dose, exercises };
}

/** Sesiones de fuerza de la semana, en orden, con los días que les tocan. */
export function strengthWeek(ctx: WeekContext): { prescription: StrengthPrescription; dayIndexes: number[] }[] {
  const out = new Map<number, { prescription: StrengthPrescription; dayIndexes: number[] }>();
  for (const d of [...ctx.days].sort((a, b) => a.day_index - b.day_index)) {
    const p = strengthForDay(ctx, d.day_index);
    if (!p) continue;
    const entry = out.get(p.session) ?? { prescription: p, dayIndexes: [] };
    entry.dayIndexes.push(d.day_index);
    out.set(p.session, entry);
  }
  return [...out.values()];
}
