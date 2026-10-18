import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatRepDistance, intensityOf, mainSetInKm, modelSpeeds, parseContentTime, roundHalfKm, runnerSpeeds, speed30FromTest } from "../src/distance";

const lib = JSON.parse(readFileSync(join(__dirname, "../../../content/training-plans/running_plans_library.json"), "utf8"));
const ch2 = modelSpeeds(lib.model_runner_assumptions, 2)!;
const ch1 = modelSpeeds(lib.model_runner_assumptions, 1)!;

describe("tiempos del contenido", () => {
  it("parsea minutos, horas y segundos", () => {
    expect(parseContentTime("55'")).toBe(3300);
    expect(parseContentTime("1h20'")).toBe(4800);
    expect(parseContentTime("1'30\"")).toBe(90);
    expect(parseContentTime("20\"")).toBe(20);
    expect(parseContentTime("rápido")).toBeNull();
  });

  it("reconoce la intensidad", () => {
    expect(intensityOf("en Umbral, pausa 2'")).toBe("umb");
    expect(intensityOf("de trote muy suave")).toBe("rec");
    expect(intensityOf("a ritmo de 3–5 km (Intenso)")).toBe("int");
    expect(intensityOf("a ritmo objetivo de 5 km (Intenso)")).toBe("r5");
    expect(intensityOf("a ritmo de 10 km (Intenso)")).toBe("r10");
    expect(intensityOf("continuos en Suave")).toBe("suave");
  });

  it("redondeos: 0,5 km en continuo; 100 m en pasadas cortas", () => {
    expect(roundHalfKm(8.71)).toBe(8.5);
    expect(roundHalfKm(8.76)).toBe(9);
    expect(roundHalfKm(0.1)).toBe(0.5);
    expect(formatRepDistance(0.377)).toBe("400 m");
    expect(formatRepDistance(1.47)).toBe("1,5 km");
    expect(formatRepDistance(1.33)).toBe("1,3 km");
    expect(formatRepDistance(2.6)).toBe("2,5 km");
  });
});

describe("parte principal en km (corredor modelo)", () => {
  it("continuos, pasadas y tramos", () => {
    // 55' a 9,5 km/h = 8,71 km → 8,5 km
    expect(mainSetInKm("55' continuos en Suave", ch2)).toBe("8,5 km continuos en Suave");
    // 8' a 11 km/h = 1,47 km → 1,5 km; la pausa sigue en minutos
    expect(mainSetInKm("3 × 8' en Umbral, pausa 2' de trote suave", ch2)).toBe("3 × 1,5 km en Umbral, pausa 2' de trote suave");
    // 70' a 9,5 = 11,08 → 11; 10' a 10,5 = 1,75 → 2; total 13
    expect(mainSetInKm("1h20': primeros 1h10' en Suave y últimos 10' en Moderado", ch2)).toBe("13 km: primeros 11 km en Suave y últimos 2 km en Moderado");
    expect(mainSetInKm("25' en Suave; al final, 6 × 20\" progresivos (Velocidad) con 1'40\" de trote suave", ch2)).toBe(
      "4 km en Suave; al final, 6 × 20\" progresivos (Velocidad) con 1'40\" de trote suave",
    );
    expect(mainSetInKm("20' trote continuo Suave", ch1)).toBe("2,5 km trote continuo Suave");
  });

  it("deja en minutos tests, caminata, cuestas y cambios de ritmo; y lo que ya está en km", () => {
    for (const t of [
      "Test de 30' a la máxima intensidad sostenible (ritmo parejo)",
      "8 × (1' trote + 2' caminata)",
      "8 × 20\" en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida",
      "25' de trote Suave; desde el minuto 6, 6 × 1' en Moderado con 2' de trote Suave entre cada uno",
      "8 × 1 km en Umbral, pausa 1' de trote suave",
      "26 km continuos en Suave",
    ])
      expect(mainSetInKm(t, ch2)).toBe(t);
    expect(mainSetInKm(null, ch2)).toBeNull();
    expect(mainSetInKm("55' continuos en Suave", null)).toBe("55' continuos en Suave");
  });
});

describe("con el test del corredor", () => {
  it("normaliza el test a 30 minutos con Riegel", () => {
    expect(speed30FromTest({ distanceKm: 6, timeS: 1800 })).toBeCloseTo(12, 6);
    // 5 km en 25' → ~5,94 km en 30' → ~11,9 km/h
    expect(speed30FromTest({ distanceKm: 5, timeS: 1500 })).toBeCloseTo(11.88, 1);
  });

  it("escala las intensidades del modelo con la proporción al test (la caminata no cambia)", () => {
    const s = runnerSpeeds(ch2, { distanceKm: 6, timeS: 1800 }); // 12 km/h vs. test del modelo 11,2
    expect(s.suave).toBeCloseTo((9.5 * 12) / 11.2, 6);
    expect(s.umb).toBeCloseTo((11 * 12) / 11.2, 6);
    expect(s.walk).toBe(6);
    // Corredor más rápido → más km en el mismo tiempo: 55' a 10,18 km/h = 9,3 → 9,5 km
    expect(mainSetInKm("55' continuos en Suave", s)).toBe("9,5 km continuos en Suave");
    // Capítulo sin velocidad de test en el contenido: usa las proporciones de referencia.
    expect(runnerSpeeds(ch1, { distanceKm: 6, timeS: 1800 }).suave).toBeCloseTo((9.5 * 12) / 11.2, 6);
  });

  it("todo el contenido se convierte sin errores y nunca deja minutos en un rodaje continuo convertido", () => {
    for (const p of lib.plans)
      for (const w of p.weeks)
        for (const d of w.days) {
          if (d.is_rest || d.strength_only) continue;
          const out = mainSetInKm(d.main_set, modelSpeeds(lib.model_runner_assumptions, p.chapter));
          expect(typeof out).toBe("string");
          if (/^\d+(h\d{2})?' continuos/.test(d.main_set)) expect(out).toMatch(/^\d+(,5)? km continuos/);
        }
  });
});
