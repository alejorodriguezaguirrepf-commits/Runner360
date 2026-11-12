import { describe, expect, it } from "vitest";
import { acuteChronic, loadStatus, mondayIso, weeklyLoads } from "@/lib/monitoring";
import { paceSPerKm, sessionLoad } from "@/lib/session-finish";
import { averageScore, wellnessFlags, wellnessLevel, wellnessScore } from "@/lib/wellness";

describe("wellness", () => {
  it("puntaje = suma de los 5 ítems y nivel", () => {
    const a = { sleep: 4, energy: 4, soreness: 3, stress: 4, mood: 5 };
    expect(wellnessScore(a)).toBe(20);
    expect(wellnessLevel(20)).toBe("great");
    expect(wellnessLevel(16)).toBe("good");
    expect(wellnessLevel(12)).toBe("fair");
    expect(wellnessLevel(11)).toBe("low");
  });
  it("marca los ítems en 1 o 2", () => {
    expect(wellnessFlags({ sleep: 2, energy: 4, soreness: 1, stress: 3, mood: 5 })).toEqual(["sleep", "soreness"]);
  });
  it("promedio con un decimal", () => {
    expect(averageScore([{ score: 18 }, { score: 15 }, { score: 20 }])).toBe(17.7);
    expect(averageScore([])).toBeNull();
  });
});

describe("carga de la sesión", () => {
  it("RPE × minutos y ritmo", () => {
    expect(sessionLoad(6, 1800)).toBe(180);
    expect(sessionLoad(null, 1800)).toBeNull();
    expect(paceSPerKm(1000, 300)).toBe(300);
  });
});

describe("carga semanal y aguda/crónica", () => {
  const today = "2026-11-11"; // miércoles
  it("lunes de la semana", () => {
    expect(mondayIso(today)).toBe("2026-11-09");
    expect(mondayIso("2026-11-09")).toBe("2026-11-09");
    expect(mondayIso("2026-11-15")).toBe("2026-11-09");
  });
  it("suma la carga por semana", () => {
    const w = weeklyLoads(
      [
        { workout_date: "2026-11-10", rpe: 5, duration_s: 3600 },
        { workout_date: "2026-11-03", rpe: 6, duration_s: 1800 },
        { workout_date: "2026-11-05", rpe: 4, duration_s: 1800 },
      ],
      today,
      3,
    );
    expect(w.map((x) => x.key)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(w.map((x) => x.load)).toEqual([0, 300, 300]);
    expect(w.map((x) => x.count)).toEqual([0, 2, 1]);
  });
  it("detecta un salto brusco de carga", () => {
    const sessions = [
      { workout_date: "2026-10-20", rpe: 5, duration_s: 1800 },
      { workout_date: "2026-10-27", rpe: 5, duration_s: 1800 },
      { workout_date: "2026-11-09", rpe: 8, duration_s: 3600 },
      { workout_date: "2026-11-10", rpe: 8, duration_s: 3600 },
    ];
    const ac = acuteChronic(sessions, today);
    expect(ac.acute).toBe(960);
    expect(ac.chronic).toBe(Math.round((960 + 150 + 150) / 4));
    expect(loadStatus(ac.ratio)).toBe("spike");
    expect(loadStatus(1)).toBe("stable");
    expect(loadStatus(null)).toBeNull();
  });
});
