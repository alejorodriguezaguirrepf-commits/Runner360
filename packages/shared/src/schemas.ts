import { z } from "zod";
import {
  BEVERAGE_TYPES,
  HYDRATION_CONTEXTS,
  RACE_DISTANCES,
  RUNNER_LEVELS,
  TRAINING_GOALS,
  WORKOUT_STATUSES,
} from "./domain";

/**
 * Esquemas de validación de entradas. Se usan en el servidor (server actions / route handlers)
 * y pueden reutilizarse en el cliente. Las reglas equivalentes de Flutter viven en
 * apps/mobile/lib/core/validation.dart y se documentan en docs/ARCHITECTURE.md.
 */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida");

export const uuid = z.uuid("Identificador inválido");

export const weekday = z.number().int().min(1).max(7);

export const MIN_AGE_YEARS = 16;

export function ageOn(birthDate: string, today: Date): number {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export const trainingProfileSchema = z
  .object({
    displayName: z.string().trim().min(2, "Ingresá al menos 2 caracteres").max(60),
    birthDate: isoDate,
    targetDistance: z.enum(RACE_DISTANCES),
    level: z.enum(RUNNER_LEVELS),
    experienceMonths: z.number().int().min(0).max(720),
    weeklyDistanceM: z.number().int().min(0).max(300_000),
    availableDays: z
      .array(weekday)
      .min(1, "Elegí al menos un día")
      .max(7)
      .refine((d) => new Set(d).size === d.length, "Días repetidos"),
    recentRaceDistanceM: z.number().int().min(1000).max(100_000).nullable(),
    recentRaceTimeS: z.number().int().min(180).max(86_400).nullable(),
    goal: z.enum(TRAINING_GOALS),
    raceDate: isoDate.nullable(),
    preferences: z.string().trim().max(500).nullable(),
    hasRecentInjury: z.boolean(),
    hasMedicalCondition: z.boolean(),
    healthNotes: z.string().trim().max(500).nullable(),
    healthDataConsent: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const age = ageOn(v.birthDate, new Date());
    if (age < MIN_AGE_YEARS || age > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: `Debés tener al menos ${MIN_AGE_YEARS} años para usar RUNNER 360`,
      });
    }
    if ((v.recentRaceDistanceM == null) !== (v.recentRaceTimeS == null)) {
      ctx.addIssue({
        code: "custom",
        path: ["recentRaceTimeS"],
        message: "Indicá distancia y tiempo de la marca, o dejá ambos vacíos",
      });
    }
    const providesHealth = v.hasRecentInjury || v.hasMedicalCondition || !!v.healthNotes;
    if (providesHealth && !v.healthDataConsent) {
      ctx.addIssue({
        code: "custom",
        path: ["healthDataConsent"],
        message: "Para guardar antecedentes de salud necesitamos tu consentimiento expreso",
      });
    }
    if (v.goal === "prepare_race" && !v.raceDate) {
      ctx.addIssue({ code: "custom", path: ["raceDate"], message: "Indicá la fecha de la competencia" });
    }
  });
export type TrainingProfileInput = z.infer<typeof trainingProfileSchema>;

export const splitSchema = z.object({
  distanceM: z.number().int().min(1).max(100_000),
  durationS: z.number().int().min(1).max(86_400),
});

export const workoutLogSchema = z
  .object({
    startedAt: z.iso.datetime({ offset: true, local: true }),
    distanceM: z.number().int().min(0).max(400_000),
    durationS: z.number().int().min(0).max(172_800),
    avgHr: z.number().int().min(30).max(250).nullable(),
    maxHr: z.number().int().min(30).max(250).nullable(),
    elevationGainM: z.number().int().min(0).max(10_000).nullable(),
    rpe: z.number().int().min(1).max(10).nullable(),
    notes: z.string().trim().max(1000).nullable(),
    calendarEntryId: uuid.nullable(),
    status: z.enum(WORKOUT_STATUSES),
    splits: z.array(splitSchema).max(200),
  })
  .superRefine((v, ctx) => {
    if (v.status !== "skipped" && v.durationS <= 0) {
      ctx.addIssue({ code: "custom", path: ["durationS"], message: "Ingresá la duración" });
    }
    if (v.avgHr != null && v.maxHr != null && v.maxHr < v.avgHr) {
      ctx.addIssue({
        code: "custom",
        path: ["maxHr"],
        message: "La FC máxima no puede ser menor que la media",
      });
    }
    const splitSum = v.splits.reduce((a, s) => a + s.distanceM, 0);
    if (v.splits.length > 0 && splitSum > v.distanceM + 50) {
      ctx.addIssue({
        code: "custom",
        path: ["splits"],
        message: "La suma de parciales supera la distancia total",
      });
    }
  });
export type WorkoutLogInput = z.infer<typeof workoutLogSchema>;

export const hydrationLogSchema = z
  .object({
    loggedAt: z.iso.datetime({ offset: true, local: true }),
    beverageType: z.enum(BEVERAGE_TYPES),
    volumeMl: z.number().int().min(1).max(5000).nullable(),
    units: z.number().int().min(1).max(20).nullable(),
    context: z.enum(HYDRATION_CONTEXTS),
    notes: z.string().trim().max(300).nullable(),
  })
  .refine((v) => v.volumeMl != null || v.units != null, {
    message: "Indicá mililitros o unidades",
    path: ["volumeMl"],
  });
export type HydrationLogInput = z.infer<typeof hydrationLogSchema>;

export const hydrationReminderSchema = z.object({
  label: z.string().trim().min(1).max(60),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida"),
  weekdays: z.array(weekday).min(1).max(7),
  enabled: z.boolean(),
});
export type HydrationReminderInput = z.infer<typeof hydrationReminderSchema>;

export const competitionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  distanceM: z.number().int().min(100).max(250_000),
  raceDate: isoDate,
  location: z.string().trim().max(120).nullable(),
  targetTimeS: z.number().int().min(60).max(172_800).nullable(),
  userPlanId: uuid.nullable(),
});
export type CompetitionInput = z.infer<typeof competitionSchema>;

export const competitionResultSchema = z.object({
  competitionId: uuid,
  finishTimeS: z.number().int().min(60).max(172_800),
  notes: z.string().trim().max(500).nullable(),
  splits: z.array(splitSchema).max(200),
});
export type CompetitionResultInput = z.infer<typeof competitionResultSchema>;

export const priceSchema = z.object({
  productId: uuid,
  currency: z.enum(["ARS", "USD"]),
  /** Importe en unidades menores (centavos). */
  amountMinor: z.number().int().min(0).max(100_000_000_00),
  interval: z.enum(["month", "year"]),
  active: z.boolean(),
});
export type PriceInput = z.infer<typeof priceSchema>;

/** Convierte "7,99" o "7.99" a centavos sin usar aritmética de punto flotante. */
export function parseMoneyToMinor(input: string): number | null {
  let raw = input.trim();
  // Formato argentino: "1.234,56" → punto como separador de miles, coma decimal.
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(raw);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export const educationalContentSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usá minúsculas, números y guiones"),
  title: z.string().trim().min(3).max(140),
  category: z.enum(["training", "hydration", "nutrition", "injury_prevention", "racing", "general"]),
  summary: z.string().trim().max(300).nullable(),
  body: z.string().trim().min(1).max(50_000),
  accessTier: z.enum(["free", "premium"]),
});
export type EducationalContentInput = z.infer<typeof educationalContentSchema>;

export const incidentReportSchema = z.object({
  kind: z.enum(["bug", "content", "payment", "account", "other"]),
  description: z.string().trim().min(10, "Contanos un poco más (mín. 10 caracteres)").max(2000),
});
export type IncidentReportInput = z.infer<typeof incidentReportSchema>;
