import { describe, expect, it } from "vitest";
import {
  acceptAiProposal,
  buildAllDemoPlans,
  buildDemoIntroductoryPlan,
  buildDemoPlan,
  canPublish,
  canTransition,
  cloneAsDraft,
  computeStart,
  evaluateWeek,
  generateCalendar,
  isoWeekday,
  matchSchedule,
  nextVersionNumber,
  planWeekForDate,
  selectPlan,
  validatePlanVersion,
  type PlanVersion,
  type RunnerProfile,
} from "../src";

const profile = (over: Partial<RunnerProfile> = {}): RunnerProfile => ({
  targetDistance: "10k",
  level: "intermediate",
  experienceMonths: 24,
  weeklyDistanceM: 25000,
  availableDays: [1, 3, 5, 7],
  raceDate: null,
  hasRecentInjury: false,
  hasMedicalCondition: false,
  ...over,
});

const catalog = buildAllDemoPlans();
const TODAY = "2026-10-01"; // jueves

describe("planes DEMO", () => {
  it("existen las 15 combinaciones más la fase introductoria", () => {
    expect(catalog).toHaveLength(16);
    expect(new Set(catalog.filter((p) => p.kind === "standard").map((p) => `${p.targetDistance}-${p.level}`)).size).toBe(15);
  });
  it.each(catalog.map((p) => [p.name, p] as const))("%s pasa la validación estructural sin errores ni advertencias", (_n, plan) => {
    const v = validatePlanVersion(plan);
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(plan.isDemo).toBe(true);
    expect(plan.validationStatus).toBe("demo_unvalidated");
    expect(plan.name).toContain("DEMO / NO VALIDADO");
    expect(plan.durationWeeks).toBeGreaterThanOrEqual(8);
    expect(plan.durationWeeks).toBeLessThanOrEqual(24);
  });
});

describe("validación de planes", () => {
  it("detecta semanas faltantes, sesiones sin volumen y patrones inválidos", () => {
    const plan = structuredClone(buildDemoPlan("5k", "beginner"));
    plan.weeks.pop();
    plan.weeks[0]!.sessions[0]!.durationS = null;
    plan.weeks[0]!.sessions[1]!.rpeMin = 9;
    plan.weeks[0]!.sessions[1]!.rpeMax = 5;
    plan.scheduleVariants = [{ id: "x", label: "x", weekdayPatterns: [[3, 1, 1]] }];
    plan.reduceOrStopCriteria = "";
    const codes = validatePlanVersion(plan).errors.map((e) => e.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "weeks_count_mismatch",
        "session_without_volume",
        "rpe_range_invalid",
        "pattern_duplicate_days",
        "pattern_not_sorted",
        "missing_stop_criteria",
      ]),
    );
  });
  it("advierte aumentos de carga por encima de la regla configurada", () => {
    const plan = structuredClone(buildDemoPlan("10k", "beginner"));
    plan.weeks[2]!.sessions[2]!.durationS = 200 * 60;
    expect(validatePlanVersion(plan).warnings.map((w) => w.code)).toContain("load_increase_above_rule");
  });
  it("rechaza duraciones fuera de 8 a 24 semanas en planes estándar", () => {
    const plan = structuredClone(buildDemoPlan("5k", "beginner"));
    plan.durationWeeks = 6;
    plan.weeks = plan.weeks.slice(0, 6);
    expect(validatePlanVersion(plan).errors.map((e) => e.code)).toContain("duration_out_of_range");
  });
});

describe("selección de plan", () => {
  const ent = { premiumPlans: false };
  it("asigna el plan de su distancia y nivel con un patrón validado", () => {
    const s = selectPlan(profile(), catalog, TODAY, ent);
    expect(s.kind).toBe("plan");
    if (s.kind !== "plan") return;
    expect(s.version.targetDistance).toBe("10k");
    expect(s.version.level).toBe("intermediate");
    expect(s.schedule.weekdayPattern).toEqual([1, 3, 5, 7]);
    expect(s.startDate).toBe("2026-10-05");
    expect(s.startWeek).toBe(1);
  });
  it("antecedentes de salud derivan a revisión profesional", () => {
    expect(selectPlan(profile({ hasRecentInjury: true }), catalog, TODAY, ent).kind).toBe("professional_review_required");
    expect(selectPlan(profile({ hasMedicalCondition: true }), catalog, TODAY, ent).kind).toBe("professional_review_required");
  });
  it("sin base suficiente recomienda la fase introductoria y no un plan exigente", () => {
    const s = selectPlan(profile({ targetDistance: "42k", level: "advanced", weeklyDistanceM: 10000 }), catalog, TODAY, ent);
    expect(s.kind).toBe("introductory_recommended");
    if (s.kind === "introductory_recommended") {
      expect(s.version?.kind).toBe("introductory");
      expect(s.reasons.length).toBeGreaterThan(0);
    }
  });
  it("si no hay patrón validado para los días disponibles, pide configuración profesional", () => {
    const s = selectPlan(profile({ availableDays: [1, 2] }), catalog, TODAY, ent);
    expect(s.kind).toBe("needs_schedule_configuration");
  });
  it("no asigna planes Premium sin suscripción", () => {
    const premium = catalog.map((p) => (p.targetDistance === "10k" && p.level === "intermediate" ? { ...p, requiresPremium: true } : p));
    expect(selectPlan(profile(), premium, TODAY, ent).kind).toBe("premium_required");
    expect(selectPlan(profile(), premium, TODAY, { premiumPlans: true }).kind).toBe("plan");
  });
  it("ignora versiones no publicadas", () => {
    const drafts = catalog.map((p) => ({ ...p, status: "draft" as const }));
    expect(selectPlan(profile(), drafts, TODAY, ent).kind).toBe("no_plan_available");
  });
  it("alinea el final del plan con la competencia", () => {
    const s = selectPlan(profile({ raceDate: "2027-03-14" }), catalog, TODAY, ent); // domingo
    expect(s.kind).toBe("plan");
    if (s.kind !== "plan") return;
    // 10 semanas: la semana 10 empieza el lunes 2027-03-08 → semana 1 el 2027-01-04
    expect(s.startDate).toBe("2027-01-04");
    const cal = generateCalendar({ version: s.version, startDate: s.startDate, startWeek: s.startWeek, weekdayPattern: s.schedule.weekdayPattern });
    expect(cal.at(-1)!.scheduledDate).toBe("2027-03-14");
  });
  it("omite como máximo las semanas iniciales configuradas", () => {
    const v = buildDemoPlan("10k", "intermediate"); // 10 semanas, maxSkippable 2
    const ok = computeStart(v, TODAY, "2026-11-29"); // 8 semanas disponibles
    expect(ok).toEqual({ ok: true, startDate: "2026-10-05", startWeek: 3, notes: expect.any(Array) });
    const tooSoon = computeStart(v, TODAY, "2026-11-08"); // 5 semanas
    expect(tooSoon).toEqual({ ok: false, weeksAvailable: 5 });
    expect(selectPlan(profile({ raceDate: "2026-11-08" }), catalog, TODAY, ent).kind).toBe("insufficient_time");
  });
  it("matchSchedule no inventa patrones", () => {
    expect(matchSchedule(buildDemoIntroductoryPlan().scheduleVariants, [1, 2, 3])).toBeNull();
    expect(matchSchedule(buildDemoIntroductoryPlan().scheduleVariants, [1, 2, 3, 4, 5, 6, 7])?.weekdayPattern).toEqual([2, 4, 6]);
  });
});

describe("calendario", () => {
  const v = buildDemoPlan("5k", "beginner");
  it("ubica cada sesión del plan en el día del patrón", () => {
    const cal = generateCalendar({ version: v, startDate: "2026-10-05", startWeek: 1, weekdayPattern: [2, 4, 6] });
    expect(cal).toHaveLength(8 * 3);
    expect(cal.slice(0, 3).map((c) => c.scheduledDate)).toEqual(["2026-10-06", "2026-10-08", "2026-10-10"]);
    expect(cal.every((c) => [2, 4, 6].includes(isoWeekday(c.scheduledDate)))).toBe(true);
    expect(cal.at(-1)).toMatchObject({ weekNumber: 8, scheduledDate: "2026-11-28" });
  });
  it("con semana inicial > 1 no genera semanas anteriores", () => {
    const cal = generateCalendar({ version: v, startDate: "2026-10-05", startWeek: 3, weekdayPattern: [2, 4, 6] });
    expect(cal[0]).toMatchObject({ weekNumber: 3, scheduledDate: "2026-10-06" });
    expect(cal).toHaveLength(6 * 3);
  });
  it("exige lunes y patrón compatible", () => {
    expect(() => generateCalendar({ version: v, startDate: "2026-10-06", startWeek: 1, weekdayPattern: [2, 4, 6] })).toThrow();
    expect(() => generateCalendar({ version: v, startDate: "2026-10-05", startWeek: 1, weekdayPattern: [2, 4] })).toThrow();
  });
  it("calcula la semana del plan para una fecha", () => {
    const p = { startDate: "2026-10-05", startWeek: 1, durationWeeks: 8 };
    expect(planWeekForDate({ ...p, date: "2026-10-04" })).toBeNull();
    expect(planWeekForDate({ ...p, date: "2026-10-11" })).toBe(1);
    expect(planWeekForDate({ ...p, date: "2026-10-12" })).toBe(2);
    expect(planWeekForDate({ ...p, date: "2026-12-01" })).toBeNull();
  });
});

describe("versionado y publicación", () => {
  it("una versión publicada solo puede archivarse", () => {
    expect(canTransition("published", "draft")).toBe(false);
    expect(canTransition("published", "archived")).toBe(true);
    expect(canTransition("draft", "published")).toBe(false);
  });
  it("clonar crea un borrador nuevo sin tocar el original", () => {
    const original = buildDemoPlan("21k", "advanced");
    const snapshot = JSON.stringify(original);
    const draft = cloneAsDraft({ ...original, id: "v1" }, nextVersionNumber([1]));
    draft.weeks[0]!.sessions[0]!.title = "Cambio";
    expect(draft.version).toBe(2);
    expect(draft.status).toBe("draft");
    expect(draft.id).toBeUndefined();
    expect(JSON.stringify(original)).toBe(snapshot);
  });
  it("un plan real requiere validación y aprobación profesional para publicarse", () => {
    const real: PlanVersion = { ...buildDemoPlan("5k", "beginner"), isDemo: false, status: "approved", validationStatus: "pending_review" };
    expect(canPublish(real).allowed).toBe(false);
    expect(canPublish({ ...real, validationStatus: "validated", approvedAt: "2026-10-01T00:00:00Z" }).allowed).toBe(true);
    expect(canPublish({ ...buildDemoPlan("5k", "beginner"), status: "approved" }).allowed).toBe(true);
    expect(canPublish({ ...buildDemoPlan("5k", "beginner"), status: "draft" }).allowed).toBe(false);
  });
});

describe("progresión", () => {
  const rules = buildDemoPlan("10k", "beginner").progressionRules;
  it("solo sugiere, según reglas configuradas", () => {
    expect(evaluateWeek({ plannedSessions: 3, doneSessions: 3, rpe: [] }, rules).kind).toBe("continue");
    expect(evaluateWeek({ plannedSessions: 3, doneSessions: 1, rpe: [] }, rules).kind).toBe("repeat_week_suggested");
    expect(
      evaluateWeek(
        { plannedSessions: 3, doneSessions: 3, rpe: [{ reported: 9, plannedMax: 5 }, { reported: 8, plannedMax: 4 }] },
        rules,
      ).kind,
    ).toBe("review_with_coach");
    expect(evaluateWeek({ plannedSessions: 0, doneSessions: 0, rpe: [] }, rules).kind).toBe("insufficient_data");
  });
});

describe("propuestas de IA", () => {
  it("siempre entran como borrador pendiente de revisión", () => {
    const r = acceptAiProposal({ ...buildDemoPlan("5k", "beginner"), status: "published", validationStatus: "validated" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.draft.status).toBe("draft");
      expect(r.draft.validationStatus).toBe("pending_review");
    }
    expect(acceptAiProposal({ nombre: "inválido" }).ok).toBe(false);
  });
});
