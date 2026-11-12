import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { StrengthExercise } from "@/lib/data/library";
import { strengthForDay, strengthWeek } from "@/lib/library/strength";

type Json = { strength_routines: Record<"A" | "B" | "C", { exercise: string; target: string; sets_reps: string; session: 1 | 2; pattern: StrengthExercise["pattern"] }[]> };
const lib = JSON.parse(readFileSync(join(__dirname, "../../../content/training-plans/running_plans_library.json"), "utf8")) as Json;
const exercises: StrengthExercise[] = (["A", "B", "C"] as const).flatMap((r) => lib.strength_routines[r].map((e, i) => ({ ...e, routine: r, position: i + 1 })));
const days = [
  { day_index: 0, is_rest: true, strength_only: true, strength_after: null },
  { day_index: 1, is_rest: false, strength_only: false, strength_after: false },
  { day_index: 3, is_rest: false, strength_only: false, strength_after: true },
  { day_index: 6, is_rest: true, strength_only: false, strength_after: null },
];

describe("fuerza en el plan", () => {
  it("cada día con fuerza tiene su sesión, 5 ejercicios y la dosis de la semana", () => {
    const ctx = { exercises, routine: "C" as const, days, week: { week: 12, week_type: "L" }, totalWeeks: 24 };
    const monday = strengthForDay(ctx, 0)!;
    const thursday = strengthForDay(ctx, 3)!;
    expect(monday.session).toBe(1);
    expect(thursday.session).toBe(2);
    expect(monday.exercises).toHaveLength(5);
    expect(monday.dose).toMatchObject({ sets: 4, reps: 4, rir: 2 });
    expect(thursday.dose).toMatchObject({ sets: 4, reps: 6 });
    expect(strengthForDay(ctx, 1)).toBeNull();
    expect(strengthWeek(ctx).map((s) => [s.prescription.session, s.dayIndexes])).toEqual([
      [1, [0]],
      [2, [3]],
    ]);
  });

  it("contenido anterior (sin patrones): la rutina completa con sus series fijas", () => {
    const legacy: StrengthExercise[] = [{ routine: "A", position: 1, exercise: "Sentadilla", target: "Piernas", sets_reps: "2–3 × 10", session: 1, pattern: null }];
    const p = strengthForDay({ exercises: legacy, routine: "A", days, week: { week: 1, week_type: "L" }, totalWeeks: 4 }, 3)!;
    expect(p.dose).toBeNull();
    expect(p.exercises.map((e) => e.sets_reps)).toEqual(["2–3 × 10"]);
  });
});
