import { describe, expect, it } from "vitest";
import { effortLabel, effortLevel, paceForPct, rpeFor, rpeTable } from "../src/effort";

describe("equivalencia porcentaje → RPE", () => {
  it("sigue la tabla: 50–65 → 2–3, 66–75 → 4–5, 76–85 → 6–7, 86–95 → 8, 96–100 → 9, más de 100 → 10", () => {
    const cases: [number, number][] = [
      [50, 2], [57, 2], [58, 3], [60, 3], [65, 3],
      [66, 4], [70, 4], [71, 5], [75, 5],
      [76, 6], [80, 6], [81, 7], [85, 7],
      [86, 8], [90, 8], [95, 8],
      [96, 9], [100, 9],
      [101, 10], [105, 10], [115, 10],
    ];
    for (const [pct, rpe] of cases) expect(rpeFor(pct), `${pct} %`).toBe(rpe);
  });

  it("formato «75 % · RPE 5»", () => {
    expect(effortLabel(75)).toBe("75 % · RPE 5");
    expect(effortLabel(100)).toBe("100 % · RPE 9");
    expect(effortLabel(115)).toBe("115 % · RPE 10");
  });

  it("el nivel de color crece con el porcentaje", () => {
    const levels = [50, 70, 80, 90, 100, 115].map(effortLevel);
    expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("la tabla de ayuda cubre todos los rangos sin huecos", () => {
    const t = rpeTable();
    expect(t[0]).toEqual({ range: "50–57 %", rpe: 2 });
    expect(t.at(-1)).toEqual({ range: "más de 100 %", rpe: 10 });
    expect(t.map((r) => r.rpe)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("ritmo por km según el test", () => {
  const test5k = { meters: 5000, seconds: 25 * 60 }; // 5:00 /km

  it("el 100 % es el ritmo del test y un porcentaje menor es más lento", () => {
    expect(paceForPct(test5k, 100)).toBe(300);
    expect(paceForPct(test5k, 75)).toBe(400);
    expect(paceForPct(test5k, 120)).toBe(250);
  });

  it("rechaza datos inválidos", () => {
    expect(() => paceForPct({ meters: 0, seconds: 100 }, 80)).toThrow();
    expect(() => paceForPct(test5k, 0)).toThrow();
  });
});
