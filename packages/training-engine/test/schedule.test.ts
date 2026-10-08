import { describe, expect, it } from "vitest";
import {
  addDays,
  ageOn,
  computeStartDate,
  currentPlanWeek,
  generateCalendar,
  isoWeekday,
  mondayOf,
  nextMondayOnOrAfter,
  resolveScheduleVariant,
} from "../src";
import { buildDemoPlan } from "../src/demo";

describe("fechas", () => {
  it("días ISO y lunes", () => {
    expect(isoWeekday("2026-10-04")).toBe(7); // domingo
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(nextMondayOnOrAfter("2026-10-02")).toBe("2026-10-05");
    expect(nextMondayOnOrAfter("2026-10-05")).toBe("2026-10-05");
  });
  it("cruza cambios de mes y años bisiestos", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("edad cumplida", () => {
    expect(ageOn("2000-10-03", "2026-10-02")).toBe(25);
    expect(ageOn("2000-10-02", "2026-10-02")).toBe(26);
  });
});

describe("variantes de distribución", () => {
  const plan = buildDemoPlan("10K", "beginner");
  it("elige la variante de mayor prioridad compatible", () => {
    const r = resolveScheduleVariant(plan, [1, 2, 3, 4, 5, 6, 7]);
    expect(r.ok && r.variant.weekdays).toEqual([2, 4, 6]);
  });
  it("respeta los días disponibles", () => {
    const r = resolveScheduleVariant(plan, [1, 3, 7]);
    expect(r.ok && r.variant.weekdays).toEqual([1, 3, 7]);
  });
  it("no inventa distribución si no hay variante validada", () => {
    const r = resolveScheduleVariant(plan, [1, 2]);
    expect(r).toEqual({ ok: false, reason: "NO_VALIDATED_VARIANT", sessionsPerWeek: 3 });
  });
});

describe("fecha de inicio", () => {
  it("sin competencia empieza el próximo lunes", () => {
    expect(computeStartDate({ today: "2026-10-02", durationWeeks: 10, startWeek: 1, raceDate: null })).toEqual({
      ok: true,
      startDate: "2026-10-05",
      weeksUntilStart: 0,
    });
  });
  it("con competencia alinea la última semana con la carrera", () => {
    const r = computeStartDate({ today: "2026-10-02", durationWeeks: 10, startWeek: 1, raceDate: "2027-01-10" });
    expect(r).toEqual({ ok: true, startDate: "2026-11-02", weeksUntilStart: 4 });
  });
  it("informa tiempo insuficiente en vez de comprimir el plan", () => {
    const r = computeStartDate({ today: "2026-10-02", durationWeeks: 10, startWeek: 1, raceDate: "2026-11-15" });
    expect(r).toEqual({ ok: false, reason: "INSUFFICIENT_TIME", weeksAvailable: 6, weeksRequired: 10 });
  });
  it("rechaza competencias pasadas", () => {
    expect(computeStartDate({ today: "2026-10-02", durationWeeks: 10, startWeek: 1, raceDate: "2026-09-01" })).toEqual({
      ok: false,
      reason: "RACE_DATE_IN_PAST",
    });
  });
});

describe("calendario", () => {
  const plan = buildDemoPlan("5K", "beginner");
  const variant = plan.scheduleVariants[0]!;
  it("ubica todas las sesiones del plan en los días de la variante", () => {
    const cal = generateCalendar({ version: plan, variant, startDate: "2026-10-05", startWeek: 1 });
    expect(cal).toHaveLength(plan.durationWeeks * plan.sessionsPerWeek);
    expect(cal[0]).toMatchObject({ weekNumber: 1, sessionNumber: 1, scheduledDate: "2026-10-06" });
    expect(cal.at(-1)).toMatchObject({ weekNumber: 8, sessionNumber: 3, scheduledDate: "2026-11-28" });
    expect(new Set(cal.map((e) => isoWeekday(e.scheduledDate)))).toEqual(new Set([2, 4, 6]));
  });
  it("omite semanas previas a la semana inicial", () => {
    const cal = generateCalendar({ version: plan, variant, startDate: "2026-10-05", startWeek: 3 });
    expect(cal).toHaveLength(6 * 3);
    expect(cal[0]).toMatchObject({ weekNumber: 3, scheduledDate: "2026-10-06" });
  });
  it("exige que el inicio sea lunes", () => {
    expect(() => generateCalendar({ version: plan, variant, startDate: "2026-10-06", startWeek: 1 })).toThrow();
  });
  it("calcula la semana en curso", () => {
    expect(currentPlanWeek({ startDate: "2026-10-05", startWeek: 1, durationWeeks: 8, today: "2026-10-04" })).toBeNull();
    expect(currentPlanWeek({ startDate: "2026-10-05", startWeek: 1, durationWeeks: 8, today: "2026-10-18" })).toBe(2);
    expect(currentPlanWeek({ startDate: "2026-10-05", startWeek: 3, durationWeeks: 8, today: "2026-10-12" })).toBe(4);
    expect(currentPlanWeek({ startDate: "2026-10-05", startWeek: 1, durationWeeks: 8, today: "2026-12-01" })).toBeNull();
  });
});
