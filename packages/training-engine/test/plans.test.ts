import { describe, expect, it } from "vitest";
import { canTransition, evaluateProgression, isEditable, nextVersionNumber, reviewProposal, validatePlanVersion } from "../src";
import { buildAllDemoPlans, buildDemoPlan, weekLoadFactor } from "../src/demo";

const rules = {
  minComplianceToAdvance: 0.6,
  repeatWeekBelowCompliance: 0.4,
  reviewAboveAvgRpe: 8.5,
  reviewOnPainReport: true,
  maxWeeklyVolumeIncreasePct: 15,
};

describe("planes DEMO", () => {
  const plans = buildAllDemoPlans();
  it("cubre las 15 combinaciones de distancia y nivel", () => {
    expect(new Set(plans.map((p) => `${p.distance}-${p.level}`)).size).toBe(15);
  });
  it("todos están marcados como DEMO y sin validación", () => {
    for (const p of plans) {
      expect(p.isDemo).toBe(true);
      expect(p.validatedBy).toBeNull();
      expect(p.name.startsWith("DEMO")).toBe(true);
    }
  });
  it.each(plans.map((p) => [p.name, p] as const))("%s pasa la validación sin errores ni advertencias", (_, p) => {
    const r = validatePlanVersion(p);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(p.durationWeeks).toBeGreaterThanOrEqual(8);
    expect(p.durationWeeks).toBeLessThanOrEqual(24);
  });
  it("la carga final se reduce", () => {
    expect(weekLoadFactor(8, 8)).toBeLessThan(weekLoadFactor(6, 8));
  });
});

describe("validación de publicación", () => {
  it("un plan no DEMO requiere validación profesional", () => {
    const r = validatePlanVersion({ ...buildDemoPlan("5K", "beginner"), isDemo: false });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("NOT_VALIDATED");
  });
  it("detecta semanas y sesiones faltantes", () => {
    const p = buildDemoPlan("5K", "beginner");
    const r = validatePlanVersion({ ...p, sessions: p.sessions.filter((s) => !(s.weekNumber === 2 && s.sessionNumber === 3)) });
    expect(r.issues).toContainEqual(expect.objectContaining({ code: "MISSING_SESSION", weekNumber: 2, sessionNumber: 3 }));
  });
  it("exige criterios de suspensión", () => {
    const p = buildDemoPlan("5K", "beginner");
    const sessions = p.sessions.map((s, i) => (i === 0 ? { ...s, stopCriteria: "" } : s));
    expect(validatePlanVersion({ ...p, sessions }).issues.map((i) => i.code)).toContain("MISSING_STOP_CRITERIA");
  });
  it("rechaza duración fuera de 8–24 semanas", () => {
    const p = buildDemoPlan("5K", "beginner");
    expect(validatePlanVersion({ ...p, durationWeeks: 6 }).issues.map((i) => i.code)).toContain("DURATION_OUT_OF_RANGE");
  });
  it("advierte saltos de volumen", () => {
    const p = buildDemoPlan("5K", "beginner");
    const sessions = p.sessions.map((s) => (s.weekNumber === 3 ? { ...s, durationS: (s.durationS ?? 0) * 2 } : s));
    const r = validatePlanVersion({ ...p, sessions });
    expect(r.ok).toBe(true);
    expect(r.issues).toContainEqual(expect.objectContaining({ code: "VOLUME_JUMP", weekNumber: 3, severity: "warning" }));
  });
});

describe("versionado", () => {
  it("solo los borradores son editables y las transiciones son controladas", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("published")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("in_review", "published")).toBe(true);
    expect(canTransition("archived", "published")).toBe(false);
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([1, 3, 2])).toBe(4);
  });
});

describe("progresión", () => {
  it("avanza con buen cumplimiento", () => {
    expect(evaluateProgression(rules, { planned: 4, done: 4, avgRpe: 5, painReported: false }).action).toBe("advance");
  });
  it("sugiere precaución o repetir según umbrales", () => {
    expect(evaluateProgression(rules, { planned: 4, done: 2, avgRpe: 5, painReported: false }).action).toBe("advance_with_caution");
    expect(evaluateProgression(rules, { planned: 4, done: 1, avgRpe: 5, painReported: false }).action).toBe("repeat_week");
  });
  it("dolor o esfuerzo excesivo derivan a revisión", () => {
    expect(evaluateProgression(rules, { planned: 4, done: 4, avgRpe: 5, painReported: true }).action).toBe("professional_review");
    expect(evaluateProgression(rules, { planned: 4, done: 4, avgRpe: 9.2, painReported: false }).action).toBe("professional_review");
  });
});

describe("propuestas de IA", () => {
  const draft = { ...buildDemoPlan("5K", "beginner"), status: "draft" as const };
  const target = draft.sessions[0]!;
  it("nunca se aplican sobre versiones publicadas", () => {
    const r = reviewProposal({ ...draft, status: "published" }, { weekNumber: 1, sessionNumber: 1, proposed: target, rationale: "" });
    expect(r).toMatchObject({ status: "rejected", reason: "VERSION_NOT_EDITABLE" });
  });
  it("rechaza sesiones inválidas", () => {
    const r = reviewProposal(draft, { weekNumber: 1, sessionNumber: 1, proposed: { ...target, stopCriteria: "" }, rationale: "" });
    expect(r).toMatchObject({ status: "rejected", reason: "PLAN_INVALID" });
  });
  it("las propuestas válidas quedan pendientes de aprobación humana", () => {
    const r = reviewProposal(draft, { weekNumber: 1, sessionNumber: 1, proposed: { ...target, title: "Rodaje suave" }, rationale: "" });
    expect(r.status).toBe("pending_human_approval");
  });
});
