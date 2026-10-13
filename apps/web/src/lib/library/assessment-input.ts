import { EXPERIENCE_LEVELS, type Assessment } from "@runner360/plan-library";
import { parseDuration } from "@runner360/training-engine";
import { z } from "zod";
import { t } from "@/i18n";

const v = t.library.assistant.validation;
const empty = (x: unknown) => (x === "" || x === undefined || x === null ? null : x);
const checkbox = z.preprocess((x) => x === true || x === "on" || x === "true", z.boolean());
const decimal = (min: number, max: number) =>
  z.preprocess((x) => (typeof x === "string" ? x.trim().replace(",", ".") : x), z.coerce.number({ message: v.number }).min(min, v.range).max(max, v.range));
const integer = (min: number, max: number) => z.coerce.number({ message: v.number }).int(v.number).min(min, v.range).max(max, v.range);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, v.date).refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), v.date);

/** Evaluación inicial del asistente "¿Cuál es mi plan?". Se valida SIEMPRE en el servidor. */
export const assessmentInputSchema = z
  .object({
    distanceKm: decimal(1, 50),
    plan: z.preprocess(empty, z.string().regex(/^plan-\d{2}$/).nullable()),
    runningMonths: z.coerce.number().pipe(z.union([z.literal(0), z.literal(3), z.literal(9), z.literal(24), z.literal(48)])),
    weeklyKm: decimal(0, 300),
    currentDays: integer(0, 7),
    continuousMinutes: integer(0, 600),
    canBriskWalk: checkbox,
    longRunKm: decimal(0, 100),
    daysAvailable: integer(1, 7),
    paceExperience: z.enum(EXPERIENCE_LEVELS),
    activeInjury: checkbox,
    overuseInjuryHistory: checkbox,
    healthFlag: checkbox,
    medicalClearance: checkbox,
    completedHalfMarathon: checkbox,
    completedMarathon: checkbox,
    markDistanceKm: z.preprocess(empty, decimal(1, 50).nullable()),
    markTime: z.preprocess(
      empty,
      z
        .string()
        .transform((s, ctx) => {
          const n = parseDuration(s.trim());
          if (n === null || n <= 0) {
            ctx.addIssue({ code: "custom", message: v.time });
            return z.NEVER;
          }
          return n;
        })
        .nullable(),
    ),
    markDate: z.preprocess(empty, date.nullable()),
    raceDate: z.preprocess(empty, date.nullable()),
  })
  .refine((x) => [x.markDistanceKm, x.markTime, x.markDate].every((y) => y === null) || [x.markDistanceKm, x.markTime, x.markDate].every((y) => y !== null), {
    message: v.markPair,
    path: ["markTime"],
  });

export type AssessmentInput = z.output<typeof assessmentInputSchema>;

export function toAssessment(i: AssessmentInput): Assessment {
  return {
    runningMonths: i.runningMonths,
    weeklyKm: i.weeklyKm,
    currentDays: i.currentDays,
    continuousMinutes: i.continuousMinutes,
    canBriskWalk: i.canBriskWalk,
    longRunKm: i.longRunKm,
    daysAvailable: i.daysAvailable,
    paceExperience: i.paceExperience,
    activeInjury: i.activeInjury,
    overuseInjuryHistory: i.overuseInjuryHistory,
    healthFlag: i.healthFlag,
    medicalClearance: i.healthFlag && i.medicalClearance,
    completedHalfMarathon: i.completedHalfMarathon,
    completedMarathon: i.completedMarathon,
    recentMark: i.markDistanceKm !== null && i.markTime !== null && i.markDate !== null ? { distanceKm: i.markDistanceKm, timeS: i.markTime, date: i.markDate } : null,
    raceDate: i.raceDate,
  };
}
