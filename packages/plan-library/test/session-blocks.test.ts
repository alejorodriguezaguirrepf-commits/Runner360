import { describe, expect, it } from "vitest";
import { needsIntensity, parseBlock, parseSegment, sessionBlocks } from "../src/session-blocks";

describe("tramos de una sesión", () => {
  it("pasadas con pausa", () => {
    expect(parseSegment("4 × 1500 m al 90 %, pausa 2 min trotando")).toEqual({
      what: "4 × 1500 m",
      pct: 90,
      recovery: "Pausa 2 min trotando",
      note: null,
    });
  });

  it("aclaración entre paréntesis", () => {
    expect(parseSegment("11 km al 70 % (sin pausas)")).toEqual({ what: "11 km", pct: 70, recovery: null, note: "Sin pausas" });
  });

  it("tramo sin porcentaje (movilidad)", () => {
    const l = parseSegment("5 min de movilidad");
    expect(l).toMatchObject({ what: "5 min de movilidad", pct: null });
    expect(needsIntensity(l)).toBe(false);
    expect(needsIntensity(parseSegment("3 km"))).toBe(true);
  });
});

describe("bloques", () => {
  it("entrada en calor: el color lo da el primer tramo, no los 100 m rápidos", () => {
    const b = parseBlock("15 min al 70 % + 5 min de movilidad + 4 × 100 m al 115 %, pausa 40 s", "warmup");
    expect(b.lines.map((l) => [l.what, l.pct, l.recovery])).toEqual([
      ["15 min", 70, null],
      ["5 min de movilidad", null, null],
      ["4 × 100 m", 115, "Pausa 40 s"],
    ]);
    expect(b.maxPct).toBe(115);
    expect(b.colorPct).toBe(70);
  });

  it("parte principal con total y varios tramos", () => {
    const b = parseBlock("15,5 km: 6,5 km al 70 % + 3 × 1000 m al 95 %, pausa 2 min trotando + 6 km al 70 %", "main");
    expect(b.total).toBe("15,5 km");
    expect(b.lines.map((l) => l.what)).toEqual(["6,5 km", "3 × 1000 m", "6 km"]);
    expect(b.lines[1]!.recovery).toBe("Pausa 2 min trotando");
    expect(b.colorPct).toBe(95);
  });

  it("texto de una versión anterior: una sola línea sin intensidad", () => {
    const b = parseBlock("4 × 1500 m en Umbral (100 %), pausa 2' de trote suave", "main");
    expect(b.lines).toEqual([{ what: "4 × 1500 m en Umbral (100 %), pausa 2' de trote suave", pct: null, recovery: null, note: null }]);
    expect(b.maxPct).toBeNull();
  });

  it("los tres bloques, con vacíos", () => {
    const [w, m, c] = sessionBlocks({ warmup: "", main_set: "8 km al 70 %", cooldown: null });
    expect(w!.lines).toEqual([]);
    expect(m!.lines[0]).toMatchObject({ what: "8 km", pct: 70 });
    expect(c!.lines).toEqual([]);
  });
});
