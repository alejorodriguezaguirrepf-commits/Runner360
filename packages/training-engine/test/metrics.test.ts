import { describe, expect, it } from "vitest";
import { formatDuration, formatPace, parseDuration, parseKmToMeters } from "@runner360/shared";
import vectors from "../fixtures/pace-vectors.json";
import {
  computeCompliance,
  consistency,
  evenSplits,
  fillWeeks,
  finishTimeAtPace,
  monthlyTotals,
  paceSecondsPerKm,
  personalBests,
  speedKmh,
  targetPace,
  totals,
  weeklyTotals,
  type WorkoutLike,
} from "../src";

describe("ritmo y velocidad (vectores compartidos con Flutter)", () => {
  for (const v of vectors.pace) {
    it(`${v.distanceM} m en ${v.durationS} s`, () => {
      const pace = paceSecondsPerKm(v.distanceM, v.durationS);
      if (v.paceSPerKm == null) expect(pace).toBeNull();
      else expect(pace).toBeCloseTo(v.paceSPerKm, 9);
      const speed = speedKmh(v.distanceM, v.durationS);
      if (v.speedKmh == null) expect(speed).toBeNull();
      else expect(speed).toBeCloseTo(v.speedKmh, 9);
      expect(formatPace(pace)).toBe(v.formattedPace);
    });
  }
  it("rechaza valores no finitos o negativos", () => {
    expect(paceSecondsPerKm(Number.NaN, 100)).toBeNull();
    expect(paceSecondsPerKm(-10, 100)).toBeNull();
    expect(speedKmh(1000, Number.POSITIVE_INFINITY)).toBeNull();
  });
  for (const v of vectors.duration) {
    it(`formatea ${v.seconds} s`, () => expect(formatDuration(v.seconds)).toBe(v.formatted));
  }
  for (const v of vectors.parseKm) {
    it(`parsea km "${v.input}"`, () => expect(parseKmToMeters(v.input)).toBe(v.meters));
  }
  for (const v of vectors.parseDuration) {
    it(`parsea duración "${v.input}"`, () => expect(parseDuration(v.input)).toBe(v.seconds));
  }
});

describe("calculadora de ritmo", () => {
  it("ritmo objetivo y tiempo final son inversos", () => {
    const p = targetPace(42195, 4 * 3600)!;
    expect(finishTimeAtPace(42195, p)).toBe(14400);
  });
  it("valida entradas", () => {
    expect(targetPace(0, 100)).toBeNull();
    expect(finishTimeAtPace(1000, 0)).toBeNull();
    expect(evenSplits(1000, 100, 0)).toEqual([]);
  });
  for (const v of vectors.splits) {
    it(`parciales ${v.distanceM}/${v.splitDistanceM}`, () => {
      const s = evenSplits(v.distanceM, v.targetTimeS, v.splitDistanceM);
      expect(s).toHaveLength(v.count);
      expect(s.at(-1)!.cumulativeTimeS).toBe(v.lastCumulativeS);
      expect(s.at(-1)!.cumulativeDistanceM).toBe(v.distanceM);
      expect(s[0]!.splitTimeS).toBe(v.firstSplitS);
      expect(s.reduce((a, x) => a + x.splitTimeS, 0)).toBe(v.targetTimeS);
      expect(s.reduce((a, x) => a + x.splitDistanceM, 0)).toBe(v.distanceM);
    });
  }
});

const log = (startedAt: string, distanceM: number, durationS: number, status: WorkoutLike["status"] = "completed"): WorkoutLike => ({
  startedAt,
  distanceM,
  durationS,
  status,
});

describe("totales", () => {
  const logs = [
    log("2026-09-28T10:00:00-03:00", 5000, 1800), // lunes
    log("2026-10-04T22:30:00-03:00", 10000, 3600), // domingo noche en AR (lunes UTC)
    log("2026-10-05T08:00:00-03:00", 7000, 2400),
    log("2026-10-06T08:00:00-03:00", 0, 0, "skipped"),
  ];
  it("agrupa por semana en la zona horaria del usuario", () => {
    const w = weeklyTotals(logs);
    expect(w).toEqual([
      { key: "2026-09-28", distanceM: 15000, durationS: 5400, workouts: 2 },
      { key: "2026-10-05", distanceM: 7000, durationS: 2400, workouts: 1 },
    ]);
  });
  it("agrupa por mes", () => {
    expect(monthlyTotals(logs).map((m) => [m.key, m.distanceM])).toEqual([
      ["2026-09", 5000],
      ["2026-10", 17000],
    ]);
  });
  it("suma totales sin contar sesiones no realizadas", () => {
    expect(totals(logs)).toEqual({ distanceM: 22000, durationS: 7800, workouts: 3 });
  });
  it("completa semanas vacías y calcula consistencia", () => {
    const filled = fillWeeks(weeklyTotals(logs), "2026-09-21", "2026-10-12");
    expect(filled.map((f) => f.workouts)).toEqual([0, 2, 1, 0]);
    expect(consistency(filled, 4)).toBe(0.5);
    expect(consistency([], 4)).toBeNull();
  });
});

describe("cumplimiento", () => {
  it("cuenta solo sesiones vencidas y no de descanso", () => {
    const c = computeCompliance(
      [
        { id: "a", scheduledDate: "2026-10-01", isRest: false, logStatus: "completed" },
        { id: "b", scheduledDate: "2026-10-02", isRest: false, logStatus: "modified" },
        { id: "c", scheduledDate: "2026-10-03", isRest: false, logStatus: null },
        { id: "d", scheduledDate: "2026-10-04", isRest: true, logStatus: null },
        { id: "e", scheduledDate: "2026-10-05", isRest: false, logStatus: null },
        { id: "f", scheduledDate: "2026-10-06", isRest: false, logStatus: null },
      ],
      "2026-10-05",
    );
    expect(c).toEqual({ due: 3, completed: 1, modified: 1, skipped: 1, pending: 1, rate: 2 / 3 });
  });
  it("sin sesiones vencidas devuelve rate null (sin división por cero)", () => {
    expect(computeCompliance([], "2026-10-01").rate).toBeNull();
  });
});

describe("marcas personales", () => {
  it("toma el mejor tiempo por distancia", () => {
    const pb = personalBests([
      { name: "A", distanceM: 10000, finishTimeS: 3000, raceDate: "2026-01-01" },
      { name: "B", distanceM: 10000, finishTimeS: 2900, raceDate: "2026-05-01" },
      { name: "C", distanceM: 5000, finishTimeS: 1500, raceDate: "2026-03-01" },
    ]);
    expect(pb.map((p) => p.name)).toEqual(["C", "B"]);
  });
});
