import { describe, expect, it } from "vitest";
import { fmt } from "@/i18n";
import { assessmentInputSchema, toAssessment } from "@/lib/library/assessment-input";

const base = {
  distanceKm: "10",
  runningMonths: "24",
  weeklyKm: "25,5",
  currentDays: "4",
  continuousMinutes: "60",
  longRunKm: "12",
  daysAvailable: "4",
  paceExperience: "rhythm",
};

describe("evaluación inicial (validación en el servidor)", () => {
  it("normaliza decimales con coma y casillas", () => {
    const r = assessmentInputSchema.parse({ ...base, canBriskWalk: "on", markDistanceKm: "", markTime: "", markDate: "", raceDate: "" });
    expect(r.weeklyKm).toBe(25.5);
    expect(r.canBriskWalk).toBe(true);
    expect(r.activeInjury).toBe(false);
    expect(toAssessment(r).recentMark).toBeNull();
  });

  it("una marca necesita distancia, tiempo y fecha", () => {
    const r = assessmentInputSchema.safeParse({ ...base, markDistanceKm: "10", markTime: "", markDate: "" });
    expect(r.success).toBe(false);
    const ok = assessmentInputSchema.parse({ ...base, markDistanceKm: "10", markTime: "48:30", markDate: "2026-10-01" });
    expect(toAssessment(ok).recentMark).toEqual({ distanceKm: 10, timeS: 2910, date: "2026-10-01" });
  });

  it("rechaza valores fuera de rango y opciones desconocidas", () => {
    expect(assessmentInputSchema.safeParse({ ...base, daysAvailable: "9" }).success).toBe(false);
    expect(assessmentInputSchema.safeParse({ ...base, paceExperience: "elite" }).success).toBe(false);
    expect(assessmentInputSchema.safeParse({ ...base, plan: "../../etc" }).success).toBe(false);
  });

  it("el visto bueno médico solo cuenta si se declaró la condición", () => {
    const r = assessmentInputSchema.parse({ ...base, medicalClearance: "on" });
    expect(toAssessment(r).medicalClearance).toBe(false);
  });
});

describe("i18n", () => {
  it("interpola variables", () => {
    expect(fmt("Semana {n} de {total}", { n: 2, total: 12 })).toBe("Semana 2 de 12");
    expect(fmt("Sin {x}", {})).toBe("Sin {x}");
  });
});
