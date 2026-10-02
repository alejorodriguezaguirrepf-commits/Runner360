import { describe, expect, it } from "vitest";
import { computeCompliance, consistency, daysSinceLastWorkout, monthlyTotals, totals, weeklyTotals, type LogItem } from "../src";

const logs: LogItem[] = [
  { date: "2026-09-28", distanceM: 5000, durationS: 1800, status: "completed" },
  { date: "2026-09-30", distanceM: 6200, durationS: 2100, status: "modified" },
  { date: "2026-10-01", distanceM: null, durationS: null, status: "skipped" },
  { date: "2026-10-04", distanceM: 10050, durationS: 3600, status: "completed" },
  { date: "2026-10-06", distanceM: 4000, durationS: 1500, status: "completed" },
];

describe("cumplimiento", () => {
  it("cuenta solo sesiones vencidas", () => {
    const c = computeCompliance(
      [
        { scheduledDate: "2026-09-29", status: "completed" },
        { scheduledDate: "2026-10-01", status: "modified" },
        { scheduledDate: "2026-10-02", status: "pending" },
        { scheduledDate: "2026-10-03", status: "skipped" },
        { scheduledDate: "2026-10-05", status: "pending" },
      ],
      "2026-10-03",
    );
    expect(c).toEqual({ due: 4, completed: 1, modified: 1, skipped: 1, missed: 1, rate: 0.5 });
  });
  it("sin sesiones vencidas el cumplimiento es nulo, no cero", () => {
    expect(computeCompliance([{ scheduledDate: "2026-10-10", status: "pending" }], "2026-10-02").rate).toBeNull();
  });
});

describe("volumen", () => {
  it("suma semanal con enteros y semanas vacías incluidas", () => {
    const w = weeklyTotals(logs, "2026-09-21", "2026-10-06");
    expect(w).toEqual([
      { key: "2026-09-21", distanceM: 0, durationS: 0, workouts: 0 },
      { key: "2026-09-28", distanceM: 21250, durationS: 7500, workouts: 3 },
      { key: "2026-10-05", distanceM: 4000, durationS: 1500, workouts: 1 },
    ]);
  });
  it("suma mensual y total excluyendo no realizadas", () => {
    expect(monthlyTotals(logs)).toEqual([
      { key: "2026-09", distanceM: 11200, durationS: 3900, workouts: 2 },
      { key: "2026-10", distanceM: 14050, durationS: 5100, workouts: 2 },
    ]);
    expect(totals(logs)).toEqual({ distanceM: 25250, durationS: 9000, workouts: 4 });
  });
  it("consistencia y días desde el último entrenamiento", () => {
    expect(consistency(logs, "2026-10-06", 4)).toEqual({ activeWeeks: 2, weeks: 4, rate: 0.5 });
    expect(daysSinceLastWorkout(logs, "2026-10-08")).toBe(2);
    expect(daysSinceLastWorkout([], "2026-10-08")).toBeNull();
  });
});
