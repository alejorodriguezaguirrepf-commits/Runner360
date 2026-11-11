import { describe, expect, it } from "vitest";
import { acuteChronic, loadStatus, mondayIso, weeklyLoads } from "@/lib/monitoring";
import { parseKmInput, sessionLoad, splitSlots, summarize } from "@/lib/session-finish";
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

describe("Finalizar sesión: parciales por km", () => {
  it("un parcial por km y uno final con lo que sobra", () => {
    expect(splitSlots(5000).map((s) => s.meters)).toEqual([1000, 1000, 1000, 1000, 1000]);
    expect(splitSlots(8500).map((s) => s.meters)).toEqual([1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 500]);
    expect(splitSlots(8500).at(-1)!.index).toBe(9);
  });
  it("un resto de menos de 50 m se suma al último km", () => {
    expect(splitSlots(5030).map((s) => s.meters)).toEqual([1000, 1000, 1000, 1000, 1030]);
    expect(splitSlots(400).map((s) => s.meters)).toEqual([400]);
    expect(splitSlots(0)).toEqual([]);
  });
  it("lee los km con coma o punto", () => {
    expect(parseKmInput("8,5")).toBe(8500);
    expect(parseKmInput("10")).toBe(10000);
    expect(parseKmInput("abc")).toBeNull();
    expect(parseKmInput("0")).toBeNull();
    expect(parseKmInput("150")).toBeNull();
  });
  it("totales, ritmo medio, km más rápido y carga (RPE × minutos)", () => {
    const s = summarize(
      [
        { meters: 1000, seconds: 330 },
        { meters: 1000, seconds: 310 },
        { meters: 1000, seconds: 345 },
        { meters: 500, seconds: 160 },
      ],
      6,
    );
    expect(s.meters).toBe(3500);
    expect(s.seconds).toBe(1145);
    expect(Math.round(s.paceS!)).toBe(327);
    expect(s.fastest).toBe(1);
    expect(s.slowest).toBe(2);
    expect(s.load).toBe(Math.round(6 * (1145 / 60)));
    expect(sessionLoad(null, 1800)).toBeNull();
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
