import { describe, expect, it } from "vitest";
import {
  formatKm,
  formatMoney,
  parseMoneyToMinor,
  trainingProfileSchema,
  workoutLogSchema,
  type TrainingProfileInput,
} from "../src";

const base: TrainingProfileInput = {
  displayName: "Ana",
  birthDate: "1990-05-10",
  targetDistance: "10k",
  level: "beginner",
  experienceMonths: 6,
  weeklyDistanceM: 12000,
  availableDays: [2, 4, 6],
  recentRaceDistanceM: null,
  recentRaceTimeS: null,
  goal: "complete",
  raceDate: null,
  preferences: null,
  hasRecentInjury: false,
  hasMedicalCondition: false,
  healthNotes: null,
  healthDataConsent: false,
};

describe("perfil deportivo", () => {
  it("acepta un perfil válido", () => expect(trainingProfileSchema.safeParse(base).success).toBe(true));
  it("exige consentimiento para datos de salud", () => {
    const r = trainingProfileSchema.safeParse({ ...base, hasRecentInjury: true });
    expect(r.success).toBe(false);
    expect(trainingProfileSchema.safeParse({ ...base, hasRecentInjury: true, healthDataConsent: true }).success).toBe(true);
  });
  it("exige edad mínima", () => {
    expect(trainingProfileSchema.safeParse({ ...base, birthDate: "2020-01-01" }).success).toBe(false);
  });
  it("exige marca completa y fecha de competencia cuando corresponde", () => {
    expect(trainingProfileSchema.safeParse({ ...base, recentRaceDistanceM: 5000 }).success).toBe(false);
    expect(trainingProfileSchema.safeParse({ ...base, goal: "prepare_race" }).success).toBe(false);
  });
  it("rechaza días repetidos", () => {
    expect(trainingProfileSchema.safeParse({ ...base, availableDays: [1, 1] }).success).toBe(false);
  });
});

describe("registro de entrenamiento", () => {
  const w = {
    startedAt: "2026-10-01T07:30:00-03:00",
    distanceM: 8000,
    durationS: 2700,
    avgHr: 150,
    maxHr: 170,
    elevationGainM: null,
    rpe: 5,
    notes: null,
    calendarEntryId: null,
    status: "completed" as const,
    splits: [],
  };
  it("acepta datos válidos", () => expect(workoutLogSchema.safeParse(w).success).toBe(true));
  it("rechaza duración cero en sesiones completadas", () =>
    expect(workoutLogSchema.safeParse({ ...w, durationS: 0 }).success).toBe(false));
  it("permite registrar una sesión no realizada sin duración", () =>
    expect(workoutLogSchema.safeParse({ ...w, status: "skipped", durationS: 0, distanceM: 0 }).success).toBe(true));
  it("rechaza FC máxima menor que la media", () =>
    expect(workoutLogSchema.safeParse({ ...w, maxHr: 120 }).success).toBe(false));
  it("rechaza parciales que superan la distancia", () =>
    expect(workoutLogSchema.safeParse({ ...w, splits: [{ distanceM: 9000, durationS: 2700 }] }).success).toBe(false));
});

describe("dinero y formatos", () => {
  it("convierte importes sin errores de punto flotante", () => {
    expect(parseMoneyToMinor("7,99")).toBe(799);
    expect(parseMoneyToMinor("7.99")).toBe(799);
    expect(parseMoneyToMinor("12.345,6")).toBe(1234560);
    expect(parseMoneyToMinor("0,1")).toBe(10);
    expect(parseMoneyToMinor("7,999")).toBeNull();
    expect(parseMoneyToMinor("-1")).toBeNull();
  });
  it("formatea moneda en es-AR", () => {
    expect(formatMoney(799, "USD")).toMatch(/7,99/);
    expect(formatMoney(1234560, "ARS")).toMatch(/12\.345,60/);
  });
  it("formatea km con coma decimal", () => {
    expect(formatKm(10500)).toBe("10,5 km");
    expect(formatKm(21097)).toBe("21,1 km");
  });
});
