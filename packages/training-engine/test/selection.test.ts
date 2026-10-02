import { describe, expect, it } from "vitest";
import { assessReadiness, assignPlan, determineStartWeek, type TrainingProfile } from "../src";
import { buildAllDemoPlans, buildDemoPlan } from "../src/demo";

const TODAY = "2026-10-02";
const base: TrainingProfile = {
  birthDate: "1990-05-10",
  targetDistance: "10K",
  level: "beginner",
  experience: "6_12m",
  weeklyKm: 10,
  availableWeekdays: [1, 2, 3, 4, 5, 6, 7],
  recentMark: null,
  goal: "complete",
  raceDate: null,
  healthFlags: [],
};
const catalog = buildAllDemoPlans().map((v, i) => ({ ...v, id: `v${i}` }));

describe("evaluación de seguridad", () => {
  it("antecedentes declarados derivan a revisión profesional", () => {
    expect(assessReadiness({ ...base, healthFlags: ["recent_injury"] }, TODAY)).toEqual({
      status: "professional_review",
      reasons: ["HEALTH_FLAGS_DECLARED"],
    });
  });
  it("menores de edad derivan a revisión", () => {
    expect(assessReadiness({ ...base, birthDate: "2010-01-01" }, TODAY).status).toBe("professional_review");
  });
  it("sin base de carrera para distancias largas sugiere fase introductoria", () => {
    expect(assessReadiness({ ...base, targetDistance: "42K", weeklyKm: 0 }, TODAY)).toEqual({
      status: "introductory_phase",
      reasons: ["NO_RUNNING_BASE_FOR_DISTANCE"],
    });
  });
  it("5K sin experiencia es apto para el plan principiante", () => {
    expect(assessReadiness({ ...base, targetDistance: "5K", weeklyKm: 0, experience: "none" }, TODAY).status).toBe("ok");
  });
});

describe("asignación de plan", () => {
  it("asigna el plan de la distancia y nivel con calendario completo", () => {
    const r = assignPlan({ profile: base, catalog, today: TODAY });
    expect(r.kind).toBe("assigned");
    if (r.kind !== "assigned") return;
    expect(r.version.distance).toBe("10K");
    expect(r.version.level).toBe("beginner");
    expect(r.startDate).toBe("2026-10-05");
    expect(r.calendar).toHaveLength(r.version.durationWeeks * 3);
  });

  it("prioriza una versión validada sobre una DEMO", () => {
    const validated = { ...buildDemoPlan("10K", "beginner"), id: "real", isDemo: false, validatedBy: "u1", validatedAt: "2026-09-01" };
    const r = assignPlan({ profile: base, catalog: [...catalog, validated], today: TODAY });
    expect(r.kind === "assigned" && r.version.id).toBe("real");
  });

  it("no asigna versiones no publicadas", () => {
    const drafts = catalog.map((v) => ({ ...v, status: "draft" as const }));
    expect(assignPlan({ profile: base, catalog: drafts, today: TODAY })).toEqual({ kind: "no_published_plan" });
  });

  it("informa requisitos de ingreso no cumplidos", () => {
    const r = assignPlan({ profile: { ...base, targetDistance: "21K", level: "advanced", weeklyKm: 20 }, catalog, today: TODAY });
    expect(r.kind).toBe("requirements_not_met");
    if (r.kind === "requirements_not_met") expect(r.unmet).toEqual(["MIN_WEEKLY_KM", "MIN_EXPERIENCE"]);
  });

  it("pide configuración profesional si la disponibilidad no tiene variante", () => {
    const r = assignPlan({ profile: { ...base, availableWeekdays: [6, 7] }, catalog, today: TODAY });
    expect(r.kind).toBe("needs_professional_configuration");
  });

  it("no comprime el plan si la competencia está demasiado cerca", () => {
    const r = assignPlan({ profile: { ...base, goal: "race", raceDate: "2026-11-01" }, catalog, today: TODAY });
    expect(r.kind).toBe("insufficient_time");
  });

  it("bloquea por seguridad antes de buscar plan", () => {
    const r = assignPlan({ profile: { ...base, healthFlags: ["medical_restriction"] }, catalog, today: TODAY });
    expect(r.kind).toBe("readiness_blocked");
  });

  it("aplica reglas de semana inicial", () => {
    const plan = buildDemoPlan("21K", "beginner");
    expect(determineStartWeek(plan, 10)).toBe(1);
    expect(determineStartWeek(plan, 30)).toBe(3);
  });
});
