import { describe, expect, it } from "vitest";
import { formatClock, formatKmValue, formatMinutes, formatPace } from "../src/format";

describe("formatos es-AR", () => {
  it("duraciones en h mm'", () => {
    expect(formatMinutes(36)).toBe("36'");
    expect(formatMinutes(37.5)).toBe(`37' 30"`);
    expect(formatMinutes(65)).toBe("1 h 05'");
    expect(formatMinutes(120)).toBe("2 h 00'");
    expect(formatMinutes(null)).toBe("—");
  });

  it("km con coma decimal", () => {
    expect(formatKmValue(3.67)).toBe("3,67 km");
    expect(formatKmValue(21.0975, { oneDecimal: true })).toBe("21,1 km");
    expect(formatKmValue(5)).toBe("5 km");
  });

  it("ritmo mm:ss/km y tiempo", () => {
    expect(formatPace(307)).toBe("5:07/km");
    expect(formatPace(0)).toBe("—");
    expect(formatClock(1530)).toBe("25:30");
    expect(formatClock(6310)).toBe("1:45:10");
  });
});
