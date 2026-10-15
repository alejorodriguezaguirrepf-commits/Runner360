import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import { raceDateFromStart } from "../src/dates";
import { isMarkRecent, referencePaces, riegelTime } from "../src/riegel";
import {
  dateOfPlanDay,
  dayMapViolations,
  IDENTITY_DAY_MAP,
  planDayAt,
  projectedRaceDate,
  scheduledWeeks,
  segmentsOf,
  type DayShape,
} from "../src/schedule";
import { librarySchema } from "../src/schema";

const library = librarySchema.parse(readLibraryJson());
const shapes = (id: string): DayShape[] =>
  library.plans
    .find((p) => p.id === id)!
    .weeks.flatMap((w) =>
      w.days.map((d) => ({ week: w.week, day_index: d.day_index, is_rest: d.is_rest, category: d.is_rest ? null : d.category, is_quality: d.is_rest ? null : d.is_quality })),
    );
const START = "2026-10-19";

describe("mover días: regla de días exigentes", () => {
  it("el mapeo original de los 21 planes es válido", () => {
    for (const p of library.plans) expect(dayMapViolations(shapes(p.id), IDENTITY_DAY_MAP), p.id).toEqual([]);
  });

  it("detecta dos exigentes seguidas y la competencia movida (igual que la base)", () => {
    expect(dayMapViolations(shapes("plan-13"), [0, 2, 1, 3, 4, 5, 6])).toContain("consecutive_demanding");
    expect(dayMapViolations(shapes("plan-01"), [0, 1, 2, 3, 4, 6, 5])).toContain("race_moved");
    expect(dayMapViolations(shapes("plan-01"), [1, 0, 2, 3, 4, 5, 6])).toEqual([]);
    expect(dayMapViolations(shapes("plan-01"), [0, 0, 2, 3, 4, 5, 6])).toEqual(["not_permutation"]);
  });

  it("planes 19–21 (5 km intermedio): misma regla, sin cambios", () => {
    for (const id of ["plan-19", "plan-20", "plan-21"]) {
      expect(dayMapViolations(shapes(id), [1, 0, 2, 3, 4, 5, 6]), id).toContain("consecutive_demanding");
      // La competencia (5 km de control en la semana 8 y carrera en la 10) no se mueve de su día.
      expect(dayMapViolations(shapes(id), [0, 1, 2, 3, 4, 6, 5]), id).toContain("race_moved");
      expect(dayMapViolations(shapes(id), [0, 1, 2, 4, 3, 5, 6]), id).toEqual([]);
    }
    // plan-21: el intenso del jueves no puede quedar al lado del umbral.
    expect(dayMapViolations(shapes("plan-21"), [0, 1, 3, 2, 4, 5, 6])).toContain("consecutive_demanding");
  });

  it("10 semanas: la competencia cae el domingo de la semana 10", () => {
    const p = library.plans.find((x) => x.id === "plan-20")!;
    const race = raceDateFromStart(START, 10);
    expect(race).toBe("2026-12-27");
    const segs = segmentsOf({ start_date: START, day_map: IDENTITY_DAY_MAP }, []);
    const weeks = scheduledWeeks(segs, p.duration_weeks);
    expect(weeks).toHaveLength(10);
    expect(weeks.at(-1)!.weekStart).toBe("2026-12-21");
    expect(projectedRaceDate(segs, p.duration_weeks, 10)).toBe(race);
    expect(dateOfPlanDay({ start_date: START, day_map: IDENTITY_DAY_MAP }, weeks.at(-1)!.weekStart, 6)).toBe(race);
  });

  it("controla también el paso de domingo a lunes", () => {
    // plan-07: martes de calidad; si pasa a lunes y el domingo anterior es exigente, se rechaza.
    const days: DayShape[] = [
      { week: 1, day_index: 6, is_rest: false, category: "thr", is_quality: true },
      { week: 2, day_index: 1, is_rest: false, category: "thr", is_quality: true },
    ];
    expect(dayMapViolations(days, [1, 0, 2, 3, 4, 5, 6])).toContain("consecutive_demanding");
    expect(dayMapViolations(days, IDENTITY_DAY_MAP)).toEqual([]);
  });
});

describe("calendario de una inscripción", () => {
  const enrollment = { start_date: START, day_map: [1, 0, 2, 3, 4, 5, 6] };

  it("sin check-ins: semana a semana desde el inicio", () => {
    const segs = segmentsOf(enrollment, []);
    expect(scheduledWeeks(segs, 4).map((w) => w.planWeek)).toEqual([1, 2, 3, 4]);
    // El día 1 del plan (martes) se hace el lunes por el mapeo.
    expect(planDayAt(enrollment, segs, 4, "2026-10-19")).toEqual({ date: "2026-10-19", planWeek: 1, dayIndex: 1 });
    expect(planDayAt(enrollment, segs, 4, "2026-10-12")).toBeNull();
    expect(planDayAt(enrollment, segs, 4, "2026-11-16")).toBeNull();
    expect(dateOfPlanDay(enrollment, START, 0)).toBe("2026-10-20");
    expect(projectedRaceDate(segs, 4, 4)).toBe(raceDateFromStart(START, 4));
  });

  it("repetir una semana desplaza el calendario y la fecha de competencia", () => {
    const segs = segmentsOf(enrollment, [{ week_start: "2026-10-26", decision: "repeat", next_week_start: "2026-11-02", next_plan_week: 2 }]);
    expect(scheduledWeeks(segs, 4).map((w) => w.planWeek)).toEqual([1, 2, 2, 3, 4]);
    expect(projectedRaceDate(segs, 4, 4)).toBe("2026-11-22");
  });

  it("pausa y retroceso", () => {
    const segs = segmentsOf(enrollment, [
      { week_start: "2026-10-26", decision: "pause", next_week_start: null, next_plan_week: null },
      { week_start: "2026-11-16", decision: "resume", next_week_start: "2026-11-16", next_plan_week: 1 },
    ]);
    expect(planDayAt(enrollment, segs, 12, "2026-11-04")).toBeNull();
    expect(scheduledWeeks(segs, 4).map((w) => [w.weekStart, w.planWeek])).toEqual([
      ["2026-10-19", 1],
      ["2026-10-26", null],
      ["2026-11-02", null],
      ["2026-11-09", null],
      ["2026-11-16", 1],
      ["2026-11-23", 2],
      ["2026-11-30", 3],
      ["2026-12-07", 4],
    ]);
  });
});

describe("Riegel", () => {
  it("T2 = T1 × (D2/D1)^1,06", () => {
    expect(riegelTime(1500, 5, 10)).toBeCloseTo(1500 * Math.pow(2, 1.06), 6);
    expect(Math.round(riegelTime(3000, 10, 21.0975))).toBe(6619);
  });

  it("solo con marcas de las últimas 8 semanas", () => {
    expect(isMarkRecent({ distanceKm: 10, timeS: 3000, date: "2026-08-20" }, "2026-10-14")).toBe(true);
    expect(isMarkRecent({ distanceKm: 10, timeS: 3000, date: "2026-08-18" }, "2026-10-14")).toBe(false);
    expect(referencePaces({ distanceKm: 10, timeS: 3000, date: "2026-06-01" }, "2026-10-14")).toBeNull();
  });

  it("ritmos de referencia; el maratón marcado como límite rápido", () => {
    const r = referencePaces({ distanceKm: 10, timeS: 3000, date: "2026-10-01" }, "2026-10-14")!;
    expect(r.map((x) => x.distanceKm)).toEqual([5, 10, 21.0975, 42.195]);
    expect(r[1]!.paceSPerKm).toBeCloseTo(300, 6);
    expect(r.filter((x) => x.marathonFastLimit).map((x) => x.distanceKm)).toEqual([42.195]);
  });

  it("rechaza valores inválidos", () => {
    expect(() => riegelTime(0, 5, 10)).toThrow();
  });
});
