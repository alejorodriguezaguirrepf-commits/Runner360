import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import { catalogSteps, recommendPlan, toCatalogPlan, type CatalogPlan } from "../src/catalog";
import { addDays, earliestStart, raceDateFromStart, startFromRaceDate, timingForRace, weekdayOf } from "../src/dates";
import { planRequirements, unclassifiedRequirements, type Assessment } from "../src/requirements";
import { librarySchema } from "../src/schema";

const library = librarySchema.parse(readLibraryJson());
const plans: CatalogPlan[] = library.plans.map(toCatalogPlan);
const lowVolume = library.individual_adaptation.find((x) => x.situation === "Volumen actual menor que el requisito")!.adaptation;
const TODAY = "2026-10-14"; // miércoles
const START = "2026-10-19"; // lunes siguiente

const base: Assessment = {
  runningMonths: 0,
  weeklyKm: 0,
  currentDays: 0,
  continuousMinutes: 0,
  canBriskWalk: true,
  longRunKm: 0,
  daysAvailable: 3,
  paceExperience: "none",
  activeInjury: false,
  overuseInjuryHistory: false,
  healthFlag: false,
  medicalClearance: false,
  completedHalfMarathon: false,
  completedMarathon: false,
  recentMark: null,
  raceDate: null,
};
const recommend = (distanceKm: number, a: Partial<Assessment>) =>
  recommendPlan({ plans, distanceKm, assessment: { ...base, ...a }, today: TODAY, lowVolumeAdaptation: lowVolume });

describe("requisitos de ingreso", () => {
  it("todos los requisitos de los 18 planes están clasificados", () => {
    for (const p of library.plans) expect(unclassifiedRequirements(p), p.id).toEqual([]);
  });

  it("min_weekly_km coincide con el requisito de volumen del texto", () => {
    for (const p of library.plans) {
      const vol = planRequirements(p).find((r) => r.kind === "weekly_volume");
      expect(vol && vol.kind === "weekly_volume" ? vol.km : null, p.id).toBe(p.min_weekly_km);
    }
  });

  it("extrae los umbrales que declara el texto", () => {
    const kinds = (id: string) => planRequirements(library.plans.find((p) => p.id === id)!);
    expect(kinds("plan-01")).toContainEqual(expect.objectContaining({ kind: "continuous_run", minutes: 20 }));
    expect(kinds("plan-07")).toContainEqual(expect.objectContaining({ kind: "continuous_run", minutes: 60 }));
    expect(kinds("plan-13")).toContainEqual(expect.objectContaining({ kind: "continuous_run", minutes: 90 }));
    expect(kinds("plan-16")).toContainEqual(expect.objectContaining({ kind: "long_run", km: 26 }));
    expect(kinds("plan-16")).toContainEqual(expect.objectContaining({ kind: "completed_race", marathonRequired: true }));
    expect(kinds("plan-17")).toContainEqual(expect.objectContaining({ kind: "completed_race", marathonRequired: false }));
    expect(kinds("plan-07")).toContainEqual(expect.objectContaining({ kind: "recent_mark", distances: [5, 10], testAllowed: true }));
    expect(kinds("plan-13")).toContainEqual(expect.objectContaining({ kind: "recent_mark", distances: [10, 21.1], testAllowed: false }));
  });
});

describe("filtros del catálogo (distancia → nivel → duración → días)", () => {
  it("sin filtros ofrece las 4 distancias", () => {
    expect(catalogSteps(plans, {}).options.distances).toEqual([5, 10, 21.0975, 42.195]);
  });

  it("5 km: el nivel se elige solo y se llega al plan en 3 toques", () => {
    const step1 = catalogSteps(plans, { distanceKm: 5 });
    expect(step1.filter.level).toBe("Principiante");
    expect(step1.options.durations).toEqual([4, 12]);
    const step3 = catalogSteps(plans, { distanceKm: 5, durationWeeks: 12, daysPerWeek: 4 });
    expect(step3.results.map((p) => p.id)).toEqual(["plan-05"]);
  });

  it("21,1 km: los días se eligen solos (siempre 6)", () => {
    const s = catalogSteps(plans, { distanceKm: 21.0975, durationWeeks: 48 });
    expect(s.filter.daysPerWeek).toBe(6);
    expect(s.results.map((p) => p.id)).toEqual(["plan-15"]);
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

describe("asistente: recomendación", () => {
  it("principiante que camina: plan de 3 meses con sus días", () => {
    const r = recommend(5, { daysAvailable: 3 });
    expect(r).toMatchObject({ kind: "recommended", startDate: START });
    expect(r.kind === "recommended" && r.plan.id).toBe("plan-04");
  });

  it("corre 25' y su carrera es en 4 semanas: plan de 1 mes", () => {
    const r = recommend(5, { continuousMinutes: 25, daysAvailable: 4, raceDate: "2026-11-15" });
    expect(r.kind === "recommended" && r.plan.id).toBe("plan-02");
    expect(r).toMatchObject({ startDate: START, raceDate: "2026-11-15" });
  });

  it("no corre 20' seguidos y su carrera es en 4 semanas: no puede empezar el plan de 1 mes", () => {
    const r = recommend(5, { continuousMinutes: 10, daysAvailable: 4, raceDate: "2026-11-15" });
    expect(r.kind).toBe("blocked");
    if (r.kind !== "blocked") return;
    expect(r.reason).toBe("race_too_soon");
    expect(r.alternative?.plan.id).toBe("plan-05");
    expect(r.contentNotes.join()).toContain("primero hace las semanas 1 a 4 del plan de 3 meses");
  });

  it("10 km con 20 km semanales y 55' continuos: el plan de 6 meses", () => {
    const r = recommend(10, { weeklyKm: 20, continuousMinutes: 55, daysAvailable: 3 });
    expect(r.kind === "recommended" && r.plan.id).toBe("plan-10");
  });

  it("10 km con poco volumen: bloqueado, con la adaptación del contenido", () => {
    const r = recommend(10, { weeklyKm: 12, continuousMinutes: 60, daysAvailable: 3 });
    expect(r.kind).toBe("blocked");
    if (r.kind === "blocked") {
      expect(r.reason).toBe("requirements");
      expect(r.contentNotes).toContain(lowVolume);
    }
  });

  it("con lesiones por sobrecarga: la frecuencia más baja posible", () => {
    const r = recommend(5, { daysAvailable: 5, overuseInjuryHistory: true });
    expect(r.kind === "recommended" && r.plan.days_per_week).toBe(3);
    const r2 = recommend(5, { daysAvailable: 5 });
    expect(r2.kind === "recommended" && r2.plan.days_per_week).toBe(5);
  });

  it("lesión activa o consulta médica pendiente: no se recomienda ningún plan", () => {
    expect(recommend(5, { activeInjury: true })).toMatchObject({ kind: "blocked", reason: "active_injury" });
    expect(recommend(5, { healthFlag: true })).toMatchObject({ kind: "blocked", reason: "medical_check" });
    expect(recommend(5, { healthFlag: true, medicalClearance: true }).kind).toBe("recommended");
  });

  it("maratón en 3 meses sin maratón previo: no se ofrece el plan de 12 semanas", () => {
    const strong: Partial<Assessment> = {
      weeklyKm: 90, currentDays: 6, daysAvailable: 6, continuousMinutes: 150, longRunKm: 28,
      paceExperience: "threshold_intervals", completedHalfMarathon: true,
      recentMark: { distanceKm: 21.1, timeS: 5400, date: "2026-10-01" },
    };
    const raceIn12 = raceDateFromStart(START, 12);
    const r = recommend(42.195, { ...strong, raceDate: raceIn12 });
    expect(r).toMatchObject({ kind: "blocked", reason: "race_too_soon" });
    expect(recommend(42.195, { ...strong, completedMarathon: true, raceDate: raceIn12 })).toMatchObject({ kind: "recommended", plan: { id: "plan-16" } });
  });
});
