import { describe, expect, it } from "vitest";
import vectors from "../test-vectors/calculations.json";
import {
  buildEvenSplits,
  formatDuration,
  formatPace,
  kmInputToMeters,
  paceForTarget,
  paceSecondsPerKm,
  parseDuration,
  speedKmh,
  timeFromPace,
} from "../src";

describe("ritmo y velocidad (vectores compartidos)", () => {
  for (const v of vectors.pace) {
    it(`${v.distanceM} m en ${v.durationS} s`, () => {
      const pace = paceSecondsPerKm(v.distanceM, v.durationS);
      const speed = speedKmh(v.distanceM, v.durationS);
      if (v.paceSPerKm === null) expect(pace).toBeNull();
      else expect(pace).toBeCloseTo(v.paceSPerKm, 5);
      if (v.speedKmh === null) expect(speed).toBeNull();
      else expect(speed).toBeCloseTo(v.speedKmh, 5);
      expect(formatPace(pace)).toBe(v.paceLabel);
    });
  }

  it("no divide por cero ni acepta valores no finitos", () => {
    expect(paceSecondsPerKm(Number.NaN, 100)).toBeNull();
    expect(paceSecondsPerKm(1000, Number.POSITIVE_INFINITY)).toBeNull();
    expect(speedKmh(-5, 100)).toBeNull();
  });
});

describe("duraciones", () => {
  for (const v of vectors.parseDuration) {
    it(`parsea "${v.input}"`, () => expect(parseDuration(v.input)).toBe(v.seconds));
  }
  for (const v of vectors.formatDuration) {
    it(`formatea ${v.seconds}`, () => expect(formatDuration(v.seconds)).toBe(v.label));
  }
  it("formatea negativos como guion", () => expect(formatDuration(-1)).toBe("—"));
});

describe("entrada de kilómetros", () => {
  for (const v of vectors.kmInput) {
    it(`"${v.input}" -> ${v.meters}`, () => expect(kmInputToMeters(v.input)).toBe(v.meters));
  }
});

describe("calculadora de objetivo", () => {
  it("tiempo a partir de ritmo", () => {
    expect(timeFromPace(10000, 300)).toBe(3000);
    expect(timeFromPace(42195, 300)).toBe(12659);
  });
  it("ritmo necesario para un objetivo", () => {
    expect(paceForTarget(21097.5, 7200)).toBeCloseTo(341.2727, 3);
  });
  it("rechaza entradas inválidas", () => {
    expect(() => timeFromPace(0, 300)).toThrow(RangeError);
    expect(() => paceForTarget(5000, 0)).toThrow(RangeError);
  });
});

describe("parciales", () => {
  for (const v of vectors.splits) {
    it(`${v.distanceM} m en ${v.targetTimeS} s cada ${v.splitM} m`, () => {
      const splits = buildEvenSplits(v.distanceM, v.targetTimeS, v.splitM);
      expect(splits.map((s) => s.cumulativeTimeS)).toEqual(v.cumulative);
      expect(splits.reduce((a, s) => a + s.splitTimeS, 0)).toBe(v.targetTimeS);
      expect(splits.at(-1)?.cumulativeDistanceM).toBe(v.distanceM);
    });
  }
});
