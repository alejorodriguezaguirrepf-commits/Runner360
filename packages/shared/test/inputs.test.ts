import { describe, expect, it } from "vitest";
import {
  formatKm,
  formatMinutesLong,
  formatMoney,
  formatPaceLabel,
  formDataToObject,
  moneyField,
  onboardingSchema,
  signUpSchema,
  splitsToRows,
  todayIn,
  workoutLogSchema,
} from "../src";

describe("registro de entrenamiento", () => {
  const base = { workoutDate: "2026-10-02", status: "completed", distanceKm: "10,5", duration: "55:30", startTime: "", avgHr: "", maxHr: "", elevationGainM: "", rpe: "5", comments: "", calendarEntryId: "", splits: "" };
  it("normaliza a metros y segundos", () => {
    const r = workoutLogSchema.parse(base);
    expect(r).toMatchObject({ distanceKm: 10500, duration: 3330, rpe: 5, avgHr: null, splits: null, painReported: false });
  });
  it("exige duración salvo si no se realizó", () => {
    expect(workoutLogSchema.safeParse({ ...base, duration: "" }).success).toBe(false);
    expect(workoutLogSchema.safeParse({ ...base, status: "skipped", duration: "", distanceKm: "" }).success).toBe(true);
  });
  it("valida FC y parciales", () => {
    expect(workoutLogSchema.safeParse({ ...base, avgHr: "180", maxHr: "170" }).success).toBe(false);
    expect(workoutLogSchema.safeParse({ ...base, distanceKm: "3", splits: "5:10, 5:05, 4:58" }).success).toBe(true);
    expect(workoutLogSchema.safeParse({ ...base, distanceKm: "3", splits: "5:10, 5:05" }).success).toBe(false);
    expect(workoutLogSchema.safeParse({ ...base, distanceKm: "2,5", splits: "5:10\n5:05\n2:30" }).success).toBe(true);
  });
  it("arma filas de parciales con el último parcial más corto", () => {
    expect(splitsToRows(2500, [310, 305, 150])).toEqual([
      { splitIndex: 1, distanceM: 1000, durationS: 310 },
      { splitIndex: 2, distanceM: 1000, durationS: 305 },
      { splitIndex: 3, distanceM: 500, durationS: 150 },
    ]);
  });
});

describe("onboarding", () => {
  const base = {
    displayName: "Ana", birthDate: "1990-01-01", targetDistance: "10K", level: "beginner", experience: "6_12m",
    weeklyKm: "12,5", availableWeekdays: ["2", "4", "6"], goal: "complete", raceDate: "", recentMarkDistanceKm: "",
    recentMarkTime: "", preferredSurface: "", preferredTime: "", healthFlags: [],
  };
  it("acepta datos válidos y normaliza", () => {
    expect(onboardingSchema.parse(base)).toMatchObject({ weeklyKm: 12.5, availableWeekdays: [2, 4, 6], raceDate: null, healthDataConsent: false });
  });
  it("requiere consentimiento para antecedentes de salud", () => {
    expect(onboardingSchema.safeParse({ ...base, healthFlags: ["recent_injury"] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...base, healthFlags: ["recent_injury"], healthDataConsent: "on" }).success).toBe(true);
  });
  it("requiere fecha si el objetivo es una competencia", () => {
    expect(onboardingSchema.safeParse({ ...base, goal: "race" }).success).toBe(false);
  });
  it("marca reciente completa o vacía", () => {
    expect(onboardingSchema.safeParse({ ...base, recentMarkDistanceKm: "5" }).success).toBe(false);
  });
});

describe("cuenta", () => {
  it("contraseña robusta y aceptación de términos", () => {
    expect(signUpSchema.safeParse({ displayName: "A", email: "a@b.co", password: "corta1", acceptTerms: "on" }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: "A", email: "a@b.co", password: "unaClaveLarga1", acceptTerms: "" }).success).toBe(false);
    expect(signUpSchema.safeParse({ displayName: "A", email: "a@b.co", password: "unaClaveLarga1", acceptTerms: "on" }).success).toBe(true);
  });
  it("FormData con campos múltiples", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("days", "1");
    fd.append("days", "3");
    expect(formDataToObject(fd, ["days", "flags"])).toEqual({ a: "1", days: ["1", "3"], flags: [] });
  });
});

describe("dinero y formato", () => {
  it("importes sin floats", () => {
    expect(moneyField.parse("7,99")).toBe(799);
    expect(moneyField.parse("7.9")).toBe(790);
    expect(moneyField.parse("15000")).toBe(1500000);
    expect(moneyField.safeParse("7,999").success).toBe(false);
    expect(formatMoney(799, "USD")).toBe("USD 7,99");
    expect(formatMoney(1500000, "ARS")).toBe("ARS 15.000,00");
  });
  it("distancias, ritmos y duraciones en es-AR", () => {
    expect(formatKm(10500)).toBe("10,5 km");
    expect(formatKm(21097)).toBe("21,1 km");
    expect(formatKm(null)).toBe("—");
    expect(formatPaceLabel(333)).toBe("5:33 /km");
    expect(formatMinutesLong(3900)).toBe("1 h 05 min");
    expect(formatMinutesLong(2700)).toBe("45 min");
  });
  it("fecha local en Buenos Aires", () => {
    expect(todayIn("America/Argentina/Buenos_Aires", new Date("2026-10-03T02:00:00Z"))).toBe("2026-10-02");
  });
});

import { zonedDateTimeToIso } from "../src";
describe("zona horaria", () => {
  it("convierte hora local de Buenos Aires a UTC", () => {
    expect(zonedDateTimeToIso("2026-10-02", "07:30", "America/Argentina/Buenos_Aires")).toBe("2026-10-02T10:30:00.000Z");
  });
  it("respeta horario de verano en Madrid", () => {
    expect(zonedDateTimeToIso("2026-07-01", "08:00", "Europe/Madrid")).toBe("2026-07-01T06:00:00.000Z");
    expect(zonedDateTimeToIso("2026-12-01", "08:00", "Europe/Madrid")).toBe("2026-12-01T07:00:00.000Z");
  });
});
