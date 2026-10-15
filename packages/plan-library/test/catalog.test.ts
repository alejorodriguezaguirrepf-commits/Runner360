import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import { catalogSteps, toCatalogPlan, type CatalogPlan } from "../src/catalog";
import { addDays, earliestStart, raceDateFromStart, startFromRaceDate, timingForRace, weekdayOf } from "../src/dates";
import { librarySchema } from "../src/schema";

const library = librarySchema.parse(readLibraryJson());
const plans: CatalogPlan[] = library.plans.map(toCatalogPlan);
const TODAY = "2026-10-14"; // miércoles
const START = "2026-10-19"; // lunes siguiente

describe("selector de planes (distancia → días → duración → nivel)", () => {
  it("sin elegir nada ofrece las 4 distancias y ningún plan", () => {
    const s = catalogSteps(plans, {});
    expect(s.options.distances).toEqual([5, 10, 21.0975, 42.195]);
    expect(s.options.days).toEqual([]);
    expect(s.plan).toBeNull();
  });

  it("5 km: días → duración, y el nivel se elige solo", () => {
    const step1 = catalogSteps(plans, { distanceKm: 5 });
    expect(step1.options.days).toEqual([3, 4, 5]);
    expect(step1.options.durations).toEqual([]);
    const step2 = catalogSteps(plans, { distanceKm: 5, daysPerWeek: 4 });
    expect(step2.options.durations).toEqual([4, 10, 12]);
    expect(step2.plan).toBeNull();
    const step3 = catalogSteps(plans, { distanceKm: 5, daysPerWeek: 4, durationWeeks: 12 });
    expect(step3.filter.level).toBe("Principiante");
    expect(step3.options.levels).toEqual(["Principiante"]);
    expect(step3.plan?.id).toBe("plan-05");
  });

  it("21,1 km: los días se eligen solos (siempre 6)", () => {
    const s = catalogSteps(plans, { distanceKm: 21.0975 });
    expect(s.filter.daysPerWeek).toBe(6);
    expect(s.options.durations).toEqual([12, 24, 48]);
    expect(catalogSteps(plans, { distanceKm: 21.0975, durationWeeks: 48 }).plan?.id).toBe("plan-15");
  });

  it("5 km tiene dos niveles: Principiante (planes 1–6) e Intermedio (planes 19–21)", () => {
    const levels = new Set<string>();
    for (const n of catalogSteps(plans, { distanceKm: 5 }).options.days)
      for (const w of catalogSteps(plans, { distanceKm: 5, daysPerWeek: n }).options.durations)
        for (const l of catalogSteps(plans, { distanceKm: 5, daysPerWeek: n, durationWeeks: w }).options.levels) levels.add(l);
    expect([...levels].sort()).toEqual(["Intermedio", "Principiante"]);
    for (const [n, id] of [[3, "plan-19"], [4, "plan-20"], [5, "plan-21"]] as const) {
      const s = catalogSteps(plans, { distanceKm: 5, daysPerWeek: n, durationWeeks: 10 });
      expect(s.filter.level).toBe("Intermedio");
      expect(s.plan?.id).toBe(id);
    }
  });

  it("descarta valores que no existen para la distancia elegida", () => {
    const s = catalogSteps(plans, { distanceKm: 10, daysPerWeek: 6, durationWeeks: 4 });
    expect(s.filter.daysPerWeek).toBeUndefined();
    expect(s.filter.durationWeeks).toBeUndefined();
    expect(s.plan).toBeNull();
  });

  it("cada combinación de las opciones lleva a exactamente un plan", () => {
    const found = new Set<string>();
    for (const d of catalogSteps(plans, {}).options.distances)
      for (const n of catalogSteps(plans, { distanceKm: d }).options.days)
        for (const w of catalogSteps(plans, { distanceKm: d, daysPerWeek: n }).options.durations) {
          const s = catalogSteps(plans, { distanceKm: d, daysPerWeek: n, durationWeeks: w });
          expect(s.plan, `${d}/${n}/${w}`).not.toBeNull();
          found.add(s.plan!.id);
        }
    expect(found.size).toBe(plans.length);
  });
});

describe("fechas", () => {
  it("lunes = 0 … domingo = 6", () => {
    expect(weekdayOf("2026-10-19")).toBe(0);
    expect(weekdayOf("2026-10-25")).toBe(6);
  });

  it("el plan empieza el próximo lunes (u hoy si es lunes)", () => {
    expect(earliestStart(TODAY)).toBe(START);
    expect(earliestStart(START)).toBe(START);
  });

  it("competencia ↔ inicio: el domingo de la semana de competencia", () => {
    expect(raceDateFromStart(START, 4)).toBe("2026-11-15");
    expect(startFromRaceDate("2026-11-15", 4)).toBe(START);
    // Plan 18: competencia en la semana 45 (no la 48).
    const p18 = plans.find((p) => p.id === "plan-18")!;
    expect(p18.race_week).toBe(45);
    expect(raceDateFromStart(START, p18.race_week)).toBe(addDays(START, 44 * 7 + 6));
  });

  it("valida que haya tiempo suficiente", () => {
    expect(timingForRace("2026-11-15", 4, TODAY)).toEqual({ ok: true, startDate: START, raceDate: "2026-11-15" });
    expect(timingForRace("2026-11-08", 4, TODAY)).toEqual({ ok: false, reason: "too_soon", earliestRaceDate: "2026-11-15" });
    expect(timingForRace("2026-11-14", 4, TODAY)).toMatchObject({ ok: false, reason: "not_sunday" });
    expect(timingForRace("2026-10-01", 4, TODAY)).toMatchObject({ ok: false, reason: "in_past" });
  });
});
