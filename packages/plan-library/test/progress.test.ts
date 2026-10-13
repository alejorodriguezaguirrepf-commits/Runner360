import { describe, expect, it } from "vitest";
import { overallAdherence, weeklyProgress, zonePercents, type ProgressInput } from "../src/progress";

const base: ProgressInput = {
  weeks: [
    { weekStart: "2026-10-19", planWeek: 1 },
    { weekStart: "2026-10-26", planWeek: 2 },
    { weekStart: "2026-11-02", planWeek: 3 },
  ],
  weekRows: [
    { week: 1, distance_km_est: 10, duration_min_est: 90, running_sessions: 2, zone_pct: { Z1: 100, Z2: 0, Z3: 0 } },
    { week: 2, distance_km_est: 12, duration_min_est: 100, running_sessions: 2, zone_pct: { Z1: 90, Z2: 10, Z3: 0 } },
  ],
  days: [
    { week: 1, day_index: 1, is_rest: false, minutes_by_intensity: { Recuperación: 10, Suave: 30 } },
    { week: 1, day_index: 3, is_rest: false, minutes_by_intensity: { Recuperación: 10, Moderado: 20 } },
    { week: 1, day_index: 0, is_rest: true, minutes_by_intensity: null },
    { week: 2, day_index: 1, is_rest: false, minutes_by_intensity: { Suave: 40 } },
    { week: 2, day_index: 3, is_rest: false, minutes_by_intensity: { Suave: 40 } },
  ],
  logs: [
    { date: "2026-10-20", planDayIndex: 1, status: "completed", durationS: 2400, distanceM: 5000 },
    { date: "2026-10-22", planDayIndex: 3, status: "skipped", durationS: null, distanceM: null },
    { date: "2026-10-27", planDayIndex: 1, status: "modified", durationS: 1800, distanceM: 4000 },
    { date: "2026-10-27", planDayIndex: null, status: "completed", durationS: 999, distanceM: 999 },
  ],
  dayMap: [0, 1, 2, 3, 4, 5, 6],
  zoneMap: { Recuperación: "Z1", Suave: "Z1", Moderado: "Z2", Umbral: "Z2", Intenso: "Z3", Velocidad: "Z3" },
  today: "2026-10-28",
};

describe("progreso planificado contra real", () => {
  it("una fila por semana transcurrida, con km, tiempo, adherencia y zonas", () => {
    const rows = weeklyProgress(base);
    expect(rows.map((r) => r.planWeek)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ plannedKm: 10, plannedMin: 90, realKm: 5, realMin: 40, dueSessions: 2, doneSessions: 1, adherence: 0.5 });
    expect(rows[0]!.zonesDoneMin).toEqual({ Z1: 40, Z2: 0, Z3: 0 });
    // Semana 2 en curso: solo vence el martes (hoy es miércoles); los registros libres no cuentan.
    expect(rows[1]).toMatchObject({ dueSessions: 1, doneSessions: 1, adherence: 1, realKm: 4 });
  });

  it("adherencia total y porcentajes de zona", () => {
    const rows = weeklyProgress(base);
    expect(overallAdherence(rows)).toBeCloseTo(2 / 3);
    expect(zonePercents({ Z1: 30, Z2: 10, Z3: 0 })).toEqual({ Z1: 75, Z2: 25, Z3: 0 });
    expect(zonePercents({ Z1: 0, Z2: 0, Z3: 0 })).toBeNull();
  });

  it("semanas sin detalle visible: usa las sesiones de los totales públicos", () => {
    const rows = weeklyProgress({ ...base, days: [], today: "2026-11-10" });
    expect(rows[0]!.dueSessions).toBe(2);
  });
});
