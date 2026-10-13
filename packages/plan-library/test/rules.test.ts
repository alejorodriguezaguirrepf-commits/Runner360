import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import {
  allowedDecisions,
  evaluateLog,
  evaluateWeek,
  missedSessions,
  nextPlanWeek,
  resumeWeek,
  ruleText,
  RULES,
  type PlannedSession,
  type SessionLog,
  type WeekContext,
} from "../src/rules";
import { librarySchema } from "../src/schema";

const library = librarySchema.parse(readLibraryJson());
const planned: PlannedSession[] = [
  { date: "2026-10-20", dayIndex: 1, category: "easy", isQuality: false },
  { date: "2026-10-22", dayIndex: 3, category: "thr", isQuality: true },
  { date: "2026-10-25", dayIndex: 6, category: "easy", isQuality: false },
];
const log = (p: Partial<SessionLog> & Pick<SessionLog, "date" | "planDayIndex">): SessionLog => ({
  status: "completed", rpe: 4, pain: 0, redFlags: [], sleep: "good", category: "easy", ...p,
});
const ctx = (p: Partial<WeekContext> = {}): WeekContext => ({
  today: "2026-10-25",
  weekStart: "2026-10-19",
  planWeek: 5,
  planned,
  logs: [log({ date: "2026-10-20", planDayIndex: 1 }), log({ date: "2026-10-22", planDayIndex: 3, category: "thr", rpe: 7 }), log({ date: "2026-10-25", planDayIndex: 6 })],
  criterionMet: true,
  previousCriterionMet: true,
  lastTrainingDate: "2026-10-25",
  deloadWeeks: [4, 8],
  ...p,
});

describe("motor de reglas de carga", () => {
  it("cada regla apunta a un texto que existe en el contenido", () => {
    for (const r of RULES) expect(ruleText(r.source, library), r.id).not.toBeNull();
  });

  it("todo bien y criterio cumplido: avanzar", () => {
    expect(evaluateWeek(ctx())).toMatchObject({ recommendation: "advance", hits: [] });
  });

  it("criterio no cumplido sin otras señales: repetir la semana", () => {
    expect(evaluateWeek(ctx({ criterionMet: false })).recommendation).toBe("repeat");
  });

  it("dolor > 5, cojera o dolor óseo: suspender y consultar (pausa)", () => {
    const pain6 = ctx({ logs: [log({ date: "2026-10-20", planDayIndex: 1, pain: 6 })] });
    expect(evaluateWeek(pain6).recommendation).toBe("pause");
    const limp = ctx({ logs: [log({ date: "2026-10-20", planDayIndex: 1, pain: 1, redFlags: ["limp"] })] });
    expect(evaluateWeek(limp).recommendation).toBe("pause");
    const bone = evaluateLog(log({ date: "2026-10-20", planDayIndex: 1, redFlags: ["bone_pain"] }));
    expect(bone.map((h) => h.id)).toContain("pain_stop");
    expect(ruleText(bone[0]!.source, library)).toContain("cojera");
  });

  it("dolor de 3 a 5: repetir la semana con menos volumen", () => {
    const r = evaluateWeek(ctx({ logs: [log({ date: "2026-10-20", planDayIndex: 1, pain: 4 }), ...ctx().logs.slice(1)] }));
    expect(r.recommendation).toBe("reduce");
    expect(evaluateLog(log({ date: "2026-10-20", planDayIndex: 1, pain: 3 })).map((h) => h.id)).toEqual(["pain_reduce"]);
    expect(evaluateLog(log({ date: "2026-10-20", planDayIndex: 1, pain: 2 }))).toEqual([]);
  });

  it("RPE de los rodajes Suaves ≥ 5 de forma habitual: repetir", () => {
    const logs = [log({ date: "2026-10-20", planDayIndex: 1, rpe: 5 }), log({ date: "2026-10-22", planDayIndex: 3, category: "thr", rpe: 7 }), log({ date: "2026-10-25", planDayIndex: 6, rpe: 6 })];
    expect(evaluateWeek(ctx({ logs })).recommendation).toBe("repeat");
    // Un solo rodaje con RPE 5 no es "habitual"; el RPE alto de la calidad no cuenta.
    expect(evaluateWeek(ctx({ logs: [logs[0]!, logs[1]!, log({ date: "2026-10-25", planDayIndex: 6 })] })).recommendation).toBe("advance");
  });

  it("una sesión perdida no se recupera: solo informa", () => {
    const r = evaluateWeek(ctx({ logs: ctx().logs.slice(1) }));
    expect(r.recommendation).toBe("advance");
    expect(r.hits.map((h) => h.id)).toEqual(["missed_one"]);
    expect(ruleText(r.hits[0]!.source, library)).toContain("no se recupera al día siguiente");
  });

  it("dos o más sesiones perdidas: repetir la semana", () => {
    const r = evaluateWeek(ctx({ logs: [ctx().logs[2]!, { ...ctx().logs[0]!, status: "skipped" }] }));
    expect(missedSessions(ctx({ logs: [ctx().logs[2]!, { ...ctx().logs[0]!, status: "skipped" }] }))).toHaveLength(2);
    expect(r.recommendation).toBe("repeat");
  });

  it("dos semanas o más sin entrenar: retroceder (la opción más conservadora)", () => {
    const r = evaluateWeek(ctx({ logs: [], lastTrainingDate: "2026-10-08" }));
    expect(r.recommendation).toBe("regress");
    expect(r.regressTo).toBe(3); // 5 − 2 = 3; la última descarga (4) es más tarde
    const r2 = evaluateWeek(ctx({ planWeek: 10, logs: [], lastTrainingDate: "2026-10-01" }));
    expect(r2.regressTo).toBe(8);
  });

  it("una semana perdida: retomar con la semana anterior", () => {
    const r = evaluateWeek(ctx({ logs: [], lastTrainingDate: "2026-10-16" }));
    expect(r).toMatchObject({ recommendation: "regress", regressTo: 4 });
  });

  it("criterio no cumplido dos semanas seguidas: volver a la última descarga", () => {
    const r = evaluateWeek(ctx({ criterionMet: false, previousCriterionMet: false }));
    expect(r).toMatchObject({ recommendation: "regress", regressTo: 4 });
  });

  it("dos noches malas seguidas: aviso (cambiar la calidad por un rodaje Suave)", () => {
    const logs = [log({ date: "2026-10-20", planDayIndex: 1, sleep: "poor" }), log({ date: "2026-10-21", planDayIndex: 2, sleep: "poor" })];
    const r = evaluateWeek(ctx({ logs: [...logs, ...ctx().logs.slice(1)] }));
    expect(r.hits.map((h) => h.id)).toContain("poor_sleep");
  });

  it("gana la regla más conservadora", () => {
    const logs = [log({ date: "2026-10-20", planDayIndex: 1, pain: 7, rpe: 6 }), log({ date: "2026-10-25", planDayIndex: 6, rpe: 6 })];
    expect(evaluateWeek(ctx({ logs })).recommendation).toBe("pause");
  });

  it("decisiones permitidas y próxima semana", () => {
    expect(allowedDecisions("pause")).toEqual(["pause"]);
    expect(allowedDecisions("advance")).toEqual(["advance", "repeat", "reduce"]);
    expect(allowedDecisions("reduce")).not.toContain("advance");
    expect(nextPlanWeek("advance", 5, null)).toBe(6);
    expect(nextPlanWeek("repeat", 5, null)).toBe(5);
    expect(nextPlanWeek("regress", 5, 3)).toBe(3);
  });

  it("al retomar después de una pausa", () => {
    expect(resumeWeek(5, "2026-10-20", "2026-10-25", [4])).toBe(5);
    expect(resumeWeek(5, "2026-10-14", "2026-10-25", [4])).toBe(4);
    expect(resumeWeek(10, "2026-10-01", "2026-10-25", [4, 8])).toBe(8);
  });
});
