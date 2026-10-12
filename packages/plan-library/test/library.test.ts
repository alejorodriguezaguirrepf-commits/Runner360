import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readLibraryJson, renderSeed, SEED_FILE } from "../scripts/paths";
import { buildImportSql, libraryChecksum, LibraryValidationError, parseLibrary } from "../src/import-sql";
import { checkInvariants, EXPECTED_PLAN_COUNT, isDemanding, planTotals, raceWeekOf } from "../src/invariants";
import { librarySchema, type Library } from "../src/schema";
import golden from "./golden-totals.json";

const raw = readLibraryJson() as Record<string, unknown>;
const clone = (): Library => structuredClone(raw) as unknown as Library;

describe("esquema estricto", () => {
  it("acepta el JSON de la biblioteca", () => {
    expect(librarySchema.safeParse(raw).success).toBe(true);
  });

  it("rechaza campos desconocidos", () => {
    const lib = clone() as unknown as { plans: Record<string, unknown>[] };
    lib.plans[0]!.extra = "x";
    expect(librarySchema.safeParse(lib).success).toBe(false);
  });

  it("rechaza un día de carrera sin calentamiento", () => {
    const lib = clone();
    const day = lib.plans[0]!.weeks[0]!.days.find((d) => !d.is_rest) as Record<string, unknown>;
    delete day.warmup;
    expect(librarySchema.safeParse(lib).success).toBe(false);
  });

  it("rechaza una categoría desconocida", () => {
    const lib = clone();
    const day = lib.plans[0]!.weeks[0]!.days.find((d) => !d.is_rest) as Record<string, unknown>;
    day.category = "tempo";
    expect(librarySchema.safeParse(lib).success).toBe(false);
  });
});

describe("invariantes", () => {
  it("el contenido real cumple todos", () => {
    expect(checkInvariants(clone())).toEqual([]);
  });

  it("plans.length = 18", () => {
    const lib = clone();
    lib.plans.pop();
    expect(checkInvariants(lib).join()).toContain(`se esperaban ${EXPECTED_PLAN_COUNT} planes`);
  });

  it("semanas = duration_weeks", () => {
    const lib = clone();
    lib.plans[3]!.weeks.pop();
    expect(checkInvariants(lib).join()).toContain("duration_weeks");
  });

  it("7 días por semana", () => {
    const lib = clone();
    lib.plans[0]!.weeks[1]!.days.pop();
    expect(checkInvariants(lib).join()).toContain("tiene 6 días");
  });

  it("sesiones de carrera por semana = days_per_week", () => {
    const lib = clone();
    lib.plans[0]!.days_per_week = 4;
    expect(checkInvariants(lib).join()).toContain("days_per_week = 4");
  });

  it("suma de km = totals con tolerancia ±0,1", () => {
    const within = clone();
    within.plans[0]!.weeks[0]!.totals.distance_km_est += 0.09;
    expect(checkInvariants(within)).toEqual([]);
    const outside = clone();
    outside.plans[0]!.weeks[0]!.totals.distance_km_est += 0.11;
    expect(checkInvariants(outside).join()).toContain("suma de km");
  });

  it("detecta dos sesiones exigentes seguidas", () => {
    const lib = clone();
    const pair = lib.plans
      .flatMap((p) => p.weeks)
      .flatMap((w) => w.days.slice(0, 6).map((d, i) => [d, w.days[i + 1]!] as const))
      .find(([a, b]) => isDemanding(a) && !b.is_rest);
    expect(pair).toBeDefined();
    const next = pair![1];
    if (!next.is_rest) next.is_quality = true;
    expect(checkInvariants(lib).join()).toContain("dos sesiones exigentes seguidas");
  });

  it("la semana de competencia del plan 18 es la 45 (no la última)", () => {
    const lib = clone();
    expect(raceWeekOf(lib.plans[17]!)).toBe(45);
    expect(lib.plans.filter((p) => raceWeekOf(p) !== p.duration_weeks).map((p) => p.id)).toEqual(["plan-18"]);
  });
});

describe("golden: totales de los 18 planes", () => {
  it("coinciden con los registrados", () => {
    expect(clone().plans.map(planTotals)).toEqual(golden);
  });

  it("324 semanas y 1.632 sesiones de carrera", () => {
    const totals = clone().plans.map(planTotals);
    expect(totals.reduce((s, t) => s + t.weeks, 0)).toBe(324);
    expect(totals.reduce((s, t) => s + t.sessions, 0)).toBe(1632);
  });

  it("los km por plan coinciden con la suma de los totales semanales del contenido", () => {
    for (const plan of clone().plans) {
      const fromWeeks = plan.weeks.reduce((s, w) => s + w.totals.distance_km_est, 0);
      expect(Math.abs(fromWeeks - planTotals(plan).distanceKm)).toBeLessThanOrEqual(0.1 * plan.weeks.length);
    }
  });
});

describe("importador", () => {
  it("valida antes de escribir y junta todos los problemas", () => {
    const lib = clone();
    lib.plans.pop();
    expect(() => parseLibrary(lib)).toThrow(LibraryValidationError);
  });

  it("la huella no depende del formato del archivo", () => {
    const compact = JSON.parse(JSON.stringify(raw));
    expect(libraryChecksum(compact)).toBe(libraryChecksum(raw));
    expect(libraryChecksum(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("genera SQL idempotente: guarda de versión y upsert por clave", () => {
    const { library, checksum } = parseLibrary(raw);
    const sql = buildImportSql(library, checksum);
    expect(sql).toContain("ya fue importada con otro contenido");
    expect(sql).not.toMatch(/^\s*(begin|commit);/m);
    const inserts = sql.match(/insert into public\.\w+/g) ?? [];
    const conflicts = sql.match(/on conflict \([^)]+\) do nothing;/g) ?? [];
    expect(inserts.length).toBeGreaterThan(0);
    expect(conflicts.length).toBe(inserts.length);
  });

  it("escapa comillas simples del contenido", () => {
    const { library, checksum } = parseLibrary(raw);
    const lib = structuredClone(library);
    lib.plans[0]!.title = "Plan d'essai";
    expect(buildImportSql(lib, checksum)).toContain("'Plan d''essai'");
  });

  it("el seed versionado está al día con el JSON", () => {
    expect(readFileSync(SEED_FILE, "utf8")).toBe(renderSeed());
  });
});
