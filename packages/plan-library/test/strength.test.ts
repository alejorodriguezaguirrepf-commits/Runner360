import { describe, expect, it } from "vitest";
import { doseLabel, strengthDose, strengthPhase, strengthSessionOf } from "../src/strength";

describe("fuerza: dosificación con variación de cargas", () => {
  it("momento del plan según el tipo de semana y el avance", () => {
    expect(strengthPhase("L", 1, 24)).toBe("base");
    expect(strengthPhase("L", 12, 24)).toBe("development");
    expect(strengthPhase("L", 20, 24)).toBe("specific");
    expect(strengthPhase("D", 4, 24)).toBe("deload");
    expect(strengthPhase("DCOMP", 16, 24)).toBe("deload");
    expect(strengthPhase("T1", 23, 24)).toBe("taper");
    expect(strengthPhase("RACE", 24, 24)).toBe("race");
  });

  it("siempre entre 3 y 6 repeticiones y no más de 4 series", () => {
    for (const t of ["L", "D", "DC", "T1", "T2", "RACE", "REC1", "TRANS"])
      for (let w = 1; w <= 48; w++)
        for (const s of [1, 2] as const)
          for (const level of ["A", "B", "C"] as const) {
            const d = strengthDose({ weekType: t, week: w, totalWeeks: 48, session: s, level });
            expect(d.reps).toBeGreaterThanOrEqual(3);
            expect(d.reps).toBeLessThanOrEqual(6);
            expect(d.sets).toBeLessThanOrEqual(4);
            expect(d.sets).toBeGreaterThanOrEqual(2);
          }
  });

  it("la sesión 1 es más pesada que la 2 en las semanas de carga (ondulante)", () => {
    for (const w of [2, 12, 20]) {
      const s1 = strengthDose({ weekType: "L", week: w, totalWeeks: 24, session: 1, level: "B" });
      const s2 = strengthDose({ weekType: "L", week: w, totalWeeks: 24, session: 2, level: "B" });
      expect(s1.reps).toBeLessThan(s2.reps);
    }
  });

  it("menos repeticiones a medida que avanza el plan; principiantes con más reserva", () => {
    const at = (w: number) => strengthDose({ weekType: "L", week: w, totalWeeks: 24, session: 1, level: "C" });
    expect([at(1).reps, at(12).reps, at(20).reps]).toEqual([5, 4, 3]);
    expect(doseLabel(at(12))).toBe("4 × 4 · 2 en reserva");
    expect(strengthDose({ weekType: "L", week: 12, totalWeeks: 24, session: 1, level: "A" }).rir).toBe(3);
  });

  it("descarga, puesta a punto y competencia: menos series y más reserva", () => {
    expect(doseLabel(strengthDose({ weekType: "D", week: 4, totalWeeks: 12, session: 1, level: "B" }))).toBe("2 × 5 · 4 en reserva");
    expect(strengthDose({ weekType: "RACE", week: 12, totalWeeks: 12, session: 1, level: "B" }).note).toContain("3 días antes");
  });

  it("alterna la sesión 1 y 2 en los días con fuerza de la semana", () => {
    const days = [
      { day_index: 0, is_rest: true, strength_only: true },
      { day_index: 1, is_rest: false, strength_only: false, strength_after: false },
      { day_index: 3, is_rest: false, strength_only: false, strength_after: true },
      { day_index: 5, is_rest: false, strength_only: false, strength_after: true },
    ];
    expect(strengthSessionOf(days, 0)).toBe(1);
    expect(strengthSessionOf(days, 3)).toBe(2);
    expect(strengthSessionOf(days, 5)).toBe(1);
    expect(strengthSessionOf(days, 1)).toBeNull();
  });
});
