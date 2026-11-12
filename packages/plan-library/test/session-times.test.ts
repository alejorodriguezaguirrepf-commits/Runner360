import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import { sessionBlocks } from "../src/session-blocks";
import { pauseSeconds, plausibleSplit, sessionTimes, sessionTotals } from "../src/session-times";
import type { Library } from "../src/schema";

const test5k = { meters: 5000, seconds: 1500 }; // 5:00/km

describe("tiempos de la sesión", () => {
  it("pasadas: una fila por repetición con su tiempo según el porcentaje", () => {
    const t = sessionTimes({ warmup: "15 min al 70 %", main_set: "5 × 1000 m al 100 %, pausa 2 min trotando", cooldown: "10 min al 60 %" }, test5k);
    const main = t.rows.filter((r) => r.block === "main");
    expect(main).toHaveLength(5);
    expect(main.map((r) => r.seconds)).toEqual([300, 300, 300, 300, 300]);
    expect(main[2]).toMatchObject({ rep: 3, reps: 5, editable: true, meters: 1000 });
    expect(t.pausesS).toBe(4 * 120);
    expect(t.rows[0]).toMatchObject({ label: "15 min", seconds: 900, editable: false, estMeters: Math.round((900 / (300 / 0.7)) * 1000) });
  });

  it("sin test: los tramos por distancia no tienen tiempo prescripto", () => {
    const t = sessionTimes({ warmup: null, main_set: "6,5 km al 70 %", cooldown: null }, null);
    expect(t.rows).toEqual([expect.objectContaining({ label: "6,5 km", meters: 6500, seconds: null, editable: true })]);
    expect(sessionTotals(t, [null])).toBeNull();
    expect(sessionTotals(t, [2700])).toEqual({ meters: 6500, seconds: 2700 });
  });

  it("totales: lo real reemplaza a lo prescripto; los cambios al final no suman", () => {
    const t = sessionTimes({ warmup: null, main_set: "3,5 km al 70 % + al final: 4 × 100 m al 80 %, pausa 40 s", cooldown: null }, test5k);
    expect(t.rows.map((r) => r.embedded)).toEqual([false, true, true, true, true]);
    expect(t.pausesS).toBe(0);
    const pres = sessionTotals(t, [])!;
    expect(pres.meters).toBe(3500);
    expect(pres.seconds).toBe(Math.round((300 / 0.7) * 3.5));
    expect(sessionTotals(t, [1500])!.seconds).toBe(1500);
  });

  it("pausas y ritmos razonables", () => {
    expect(pauseSeconds("Pausa 2 min 30 s trotando")).toBe(150);
    expect(pauseSeconds("Pausa 40 s")).toBe(40);
    expect(pauseSeconds("Vuelta caminando al punto de partida")).toBe(0);
    expect(plausibleSplit(1000, 300)).toBe(true);
    expect(plausibleSplit(1000, 30)).toBe(false);
  });

  it("todas las sesiones de la biblioteca: cada tramo con distancia o tiempo se entiende", () => {
    const lib = readLibraryJson() as Library;
    let lines = 0;
    for (const p of lib.plans)
      for (const w of p.weeks)
        for (const d of w.days) {
          if (d.is_rest) continue;
          const t = sessionTimes(d, test5k);
          const measurable = sessionBlocks(d)
            .flatMap((b) => b.lines)
            .filter((l) => /\d+(,\d+)? (m|km|min)\b/.test(l.what) && !/movilidad|estiramientos|técnica/i.test(l.what));
          lines += measurable.length;
          const expected = measurable.reduce((a, l) => a + Number(/^(?:[^:]+:\s*)?(\d+) ×/.exec(l.what)?.[1] ?? 1), 0);
          const got = t.rows.filter((r) => !/movilidad|estiramientos|técnica/i.test(r.label)).length;
          expect(got, `${p.id} s${w.week} d${d.day_index}`).toBeGreaterThanOrEqual(expected);
          expect(sessionTotals(t, [])).not.toBeNull();
        }
    expect(lines).toBeGreaterThan(5000);
  });
});
