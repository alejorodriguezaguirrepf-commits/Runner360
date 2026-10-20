import { describe, expect, it } from "vitest";
import { readLibraryJson } from "../scripts/paths";
import { nearestAllowed, snapReps } from "../scripts/rebuild-plans";
import { isSession } from "../src/invariants";
import {
  ALLOWED_REP_METERS,
  averageWeeklyKm,
  checkQualityRules,
  levelVolumeProblems,
  repDistances,
  repeatedQuality,
  timedReps,
  timedRunning,
} from "../src/quality-rules";
import type { Library, LibrarySessionDay } from "../src/schema";

const raw = readLibraryJson() as Library;
const clone = (): Library => structuredClone(raw);
const sessions = (lib: Library) => lib.plans.flatMap((p) => p.weeks.flatMap((w) => w.days.filter(isSession)));
const firstQuality = (lib: Library, plan: number, week: number): LibrarySessionDay =>
  lib.plans[plan]!.weeks[week]!.days.find((d): d is LibrarySessionDay => isSession(d) && d.is_quality && d.category !== "race")!;

describe("validador de reglas de calidad", () => {
  it("el contenido real cumple todas las reglas", () => {
    expect(checkQualityRules(clone())).toEqual([]);
  });

  it("falla con una sesión de calidad igual a la de la semana anterior", () => {
    const lib = clone();
    firstQuality(lib, 6, 1).main_set = firstQuality(lib, 6, 0).main_set;
    expect(repeatedQuality(lib.plans[6]!)).toHaveLength(1);
    expect(checkQualityRules(lib).join("\n")).toContain("plan-07 semana 2: sesión de calidad igual a la semana anterior");
  });

  it("falla con una pasada fuera de la lista", () => {
    const lib = clone();
    firstQuality(lib, 12, 0).main_set = "5 × 1200 m en Umbral (95 %), pausa 1' de trote suave";
    expect(checkQualityRules(lib).join("\n")).toContain("pasada de 1200 m fuera de la lista");
  });

  it("falla con velocidad en segundos (también en la entrada en calor)", () => {
    const lib = clone();
    firstQuality(lib, 12, 0).warmup = '15\' Suave + 4 × 20" progresivos (pausa 40")';
    expect(checkQualityRules(lib).join("\n")).toContain('velocidad en segundos («4 × 20"»)');
  });

  it("falla con repeticiones o tramos de carrera por tiempo", () => {
    const lib = clone();
    firstQuality(lib, 6, 0).main_set = "3 × 8' en Umbral, pausa 2' de trote suave";
    const errors = checkQualityRules(lib).join("\n");
    expect(errors).toContain("repeticiones por tiempo («3 × 8'»)");
    expect(errors).toContain("parte principal en tiempo (8') en lugar de km");
  });

  it("falla si el intermedio no supera al principiante o supera al avanzado", () => {
    const lib = clone();
    const scale = (i: number, f: number) => {
      for (const w of lib.plans[i]!.weeks) w.totals.distance_km_est *= f;
    };
    scale(18, 0.3); // plan-19 (5 km Intermedio, 3 días) por debajo del plan-01/04 (Principiante, 3 días)
    scale(6, 4); // plan-07 (10 km Intermedio) por encima de un avanzado
    const problems = levelVolumeProblems(lib.plans).join("\n");
    expect(problems).toContain("plan-19 (Intermedio) no tiene más volumen que plan-01 (Principiante)");
    expect(problems).toMatch(/plan-07 \(Intermedio\) supera el volumen de plan-1\d \(Avanzado\)/);
  });
});

describe("reglas aplicadas al contenido", () => {
  const lib = clone();
  const byLevel = (level: string) => lib.plans.filter((p) => p.level === level).map(averageWeeklyKm);

  it("todas las pasadas son de distancias permitidas", () => {
    const allowed = new Set<number>(ALLOWED_REP_METERS);
    const reps = sessions(lib).flatMap((d) => [d.warmup, d.main_set, d.cooldown].flatMap(repDistances));
    expect(reps.length).toBeGreaterThan(1000);
    expect(reps.filter((r) => !allowed.has(r.meters))).toEqual([]);
  });

  it("sin trabajos en segundos ni partes principales de carrera en minutos", () => {
    for (const d of sessions(lib)) {
      expect(timedReps(d.warmup + " " + d.main_set + " " + d.cooldown)).toEqual([]);
      expect(timedRunning(d.main_set)).toEqual([]);
    }
  });

  it("las partes principales llevan su porcentaje (100 % = test de 5 km)", () => {
    const withIntensity = sessions(lib).filter((d) => /en (Suave|Umbral|Moderado)|a ritmo|muy suave/.test(d.main_set) && d.code !== "COMP" && !/^\d+(,\d+)? km \(/.test(d.main_set));
    expect(withIntensity.length).toBeGreaterThan(1000);
    for (const d of withIntensity) expect(d.main_set).toMatch(/\d+ %/);
  });

  it("intermedio: entre principiante y avanzado en km semanales", () => {
    expect(Math.min(...byLevel("Intermedio"))).toBeGreaterThan(Math.max(...byLevel("Principiante")));
    expect(Math.max(...byLevel("Intermedio"))).toBeLessThan(Math.min(...byLevel("Avanzado")));
  });

  it("intermedio: 2 sesiones de calidad en cada semana de carga y 3 en las semanas pico", () => {
    for (const p of lib.plans.filter((x) => x.level === "Intermedio")) {
      const quality = p.weeks.map((w) => ({ w, n: w.days.filter((d) => isSession(d) && d.is_quality).length }));
      for (const { w, n } of quality) if (w.week_type === "L") expect(n, `${p.id} semana ${w.week}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...quality.map((q) => q.n)), p.id).toBe(3);
    }
  });

  it("intermedio: la tirada larga del bloque específico tiene tramos a ritmo", () => {
    for (const p of lib.plans.filter((x) => x.level === "Intermedio")) {
      const tramos = p.weeks.flatMap((w) => w.days.filter((d): d is LibrarySessionDay => isSession(d) && d.code === "TL" && d.is_quality));
      expect(tramos.length, p.id).toBeGreaterThanOrEqual(3);
      for (const d of tramos) expect(d.main_set).toMatch(/× \d+ m a ritmo (objetivo )?de 10 km/);
    }
  });
});

describe("conversión de pasadas", () => {
  it("elige distancias de la lista conservando el volumen", () => {
    expect(snapReps(6000, 1200)).toEqual({ n: 6, m: 1000 });
    expect(snapReps(12000, 6000)).toEqual({ n: 3, m: 4000 });
    expect(snapReps(20000, 10000)).toEqual({ n: 4, m: 5000 });
    expect(snapReps(8000, 1600)).toEqual({ n: 4, m: 2000 });
  });

  it("los progresivos y cuestas de segundos pasan a la distancia más cercana", () => {
    expect(nearestAllowed(72)).toBe(100);
    expect(nearestAllowed(258, [100, 200, 300])).toBe(300);
    expect(nearestAllowed(150)).toBe(200);
  });
});
