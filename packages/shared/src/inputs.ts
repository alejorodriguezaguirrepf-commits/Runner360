import { z } from "zod";
import {
  distanceCodeSchema,
  experienceSchema,
  goalSchema,
  healthFlagSchema,
  isoDateSchema,
  kmInputToMeters,
  levelSchema,
  parseDuration,
  weekdayListSchema,
} from "@runner360/training-engine";

/**
 * Esquemas de validación de entradas de usuario (formularios web, API móvil).
 * Se ejecutan SIEMPRE en el servidor; el cliente puede reutilizarlos para feedback inmediato.
 * Aceptan strings de formularios y devuelven valores normalizados (metros, segundos, enteros).
 */

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce
      .number({ message: `${label}: ingresá un número` })
      .int(`${label}: debe ser un número entero`)
      .min(min, `${label}: mínimo ${min}`)
      .max(max, `${label}: máximo ${max}`)
      .nullable(),
  );

const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

export const kmField = (label = "Distancia") =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const m = kmInputToMeters(v);
      if (m === null) {
        ctx.addIssue({ code: "custom", message: `${label}: ingresá kilómetros, por ejemplo 10,5` });
        return z.NEVER;
      }
      return m;
    });

const optionalKmField = (label = "Distancia") =>
  z.preprocess(emptyToNull, kmField(label).nullable());

export const durationField = (label = "Duración") =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const s = parseDuration(v);
      if (s === null || s <= 0) {
        ctx.addIssue({ code: "custom", message: `${label}: usá el formato mm:ss o h:mm:ss` });
        return z.NEVER;
      }
      return s;
    });

const optionalDurationField = (label = "Duración") => z.preprocess(emptyToNull, durationField(label).nullable());

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable().default(null));

const uuidOrNull = z.preprocess(emptyToNull, z.uuid().nullable());

const weekdaysFromForm = z.preprocess(
  (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]).map((x) => Number(x)),
  weekdayListSchema,
);

// ---------------------------------------------------------------------------
// Registro y cuenta
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(72, "La contraseña es demasiado larga")
  .regex(/[A-Za-z]/, "Incluí al menos una letra")
  .regex(/\d/, "Incluí al menos un número");

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Ingresá tu nombre").max(60),
  email: z.email("Correo electrónico inválido").max(254),
  password: passwordSchema,
  acceptTerms: checkbox.refine((v) => v, "Tenés que aceptar los términos y la política de privacidad"),
});

export const signInSchema = z.object({
  email: z.email("Correo electrónico inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const emailOnlySchema = z.object({ email: z.email("Correo electrónico inválido") });
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden", path: ["confirm"] });

// ---------------------------------------------------------------------------
// Onboarding deportivo
// ---------------------------------------------------------------------------

export const onboardingSchema = z
  .object({
    displayName: z.string().trim().min(1, "Ingresá tu nombre").max(60),
    birthDate: isoDateSchema,
    targetDistance: distanceCodeSchema,
    level: levelSchema,
    experience: experienceSchema,
    weeklyKm: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(",", ".") : v),
      z.coerce.number({ message: "Km semanales: ingresá un número" }).min(0).max(300),
    ),
    availableWeekdays: weekdaysFromForm,
    goal: goalSchema,
    raceDate: z.preprocess(emptyToNull, isoDateSchema.nullable()),
    recentMarkDistanceKm: optionalKmField("Distancia de la marca"),
    recentMarkTime: optionalDurationField("Tiempo de la marca"),
    preferredSurface: z.preprocess(emptyToNull, z.enum(["road", "trail", "track", "treadmill", "mixed"]).nullable()),
    preferredTime: z.preprocess(emptyToNull, z.enum(["morning", "midday", "evening", "any"]).nullable()),
    healthDataConsent: checkbox,
    healthFlags: z.preprocess(
      (v) => (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]),
      z.array(healthFlagSchema).max(6),
    ),
  })
  .refine((v) => (v.recentMarkDistanceKm === null) === (v.recentMarkTime === null), {
    message: "Para cargar una marca, completá distancia y tiempo",
    path: ["recentMarkTime"],
  })
  .refine((v) => v.healthFlags.length === 0 || v.healthDataConsent, {
    message: "Para registrar antecedentes necesitamos tu consentimiento expreso",
    path: ["healthDataConsent"],
  })
  .refine((v) => v.goal !== "race" || v.raceDate !== null, {
    message: "Indicá la fecha de la competencia",
    path: ["raceDate"],
  });
export type OnboardingInput = z.output<typeof onboardingSchema>;

// ---------------------------------------------------------------------------
// Registro de entrenamiento
// ---------------------------------------------------------------------------

/** Parciales: tiempos por kilómetro separados por coma o salto de línea, p. ej. "5:10, 5:05". */
export const splitsField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(4000)
    .transform((v, ctx) => {
      const items = v.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
      const out: number[] = [];
      for (const [i, item] of items.entries()) {
        const s = parseDuration(item);
        if (s === null || s <= 0) {
          ctx.addIssue({ code: "custom", message: `Parcial ${i + 1} inválido: usá mm:ss` });
          return z.NEVER;
        }
        out.push(s);
      }
      return out;
    })
    .nullable(),
);

export const workoutLogSchema = z
  .object({
    workoutDate: isoDateSchema,
    startTime: z.preprocess(emptyToNull, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida").nullable()),
    status: z.enum(["completed", "modified", "skipped"]),
    distanceKm: optionalKmField(),
    duration: optionalDurationField(),
    avgHr: optionalInt(30, 250, "FC media"),
    maxHr: optionalInt(30, 250, "FC máxima"),
    elevationGainM: optionalInt(0, 10000, "Desnivel"),
    rpe: optionalInt(1, 10, "RPE"),
    painReported: checkbox,
    comments: optionalText(2000),
    calendarEntryId: uuidOrNull,
    splits: splitsField,
  })
  .refine((v) => v.status === "skipped" || v.duration !== null, {
    message: "Ingresá la duración del entrenamiento",
    path: ["duration"],
  })
  .refine((v) => v.avgHr === null || v.maxHr === null || v.avgHr <= v.maxHr, {
    message: "La FC media no puede superar la máxima",
    path: ["avgHr"],
  })
  .refine((v) => v.distanceKm === null || v.distanceKm <= 400000, { message: "Distancia fuera de rango", path: ["distanceKm"] })
  .refine((v) => v.duration === null || v.duration <= 172800, { message: "Duración fuera de rango", path: ["duration"] })
  .refine(
    (v) => {
      if (!v.splits || v.splits.length === 0) return true;
      if (v.distanceKm === null) return false;
      return v.splits.length === Math.ceil(v.distanceKm / 1000);
    },
    { message: "La cantidad de parciales debe coincidir con los kilómetros (uno por km, el último puede ser parcial)", path: ["splits"] },
  );
export type WorkoutLogInput = z.output<typeof workoutLogSchema>;

/** Convierte parciales por km en filas con distancia (el último puede ser menor a 1 km). */
export function splitsToRows(totalM: number, splitTimes: number[]): { splitIndex: number; distanceM: number; durationS: number }[] {
  return splitTimes.map((durationS, i) => ({
    splitIndex: i + 1,
    distanceM: Math.min(1000, totalM - i * 1000),
    durationS,
  }));
}

// ---------------------------------------------------------------------------
// Hidratación
// ---------------------------------------------------------------------------

export const hydrationLogSchema = z
  .object({
    logDate: isoDateSchema,
    beverage: z.enum(["water", "sports_drink", "electrolytes", "gel", "other"]),
    context: z.enum(["daily", "training", "competition"]),
    volumeMl: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().int().min(0).max(5000)),
    carbsG: optionalInt(0, 200, "Carbohidratos"),
    notes: optionalText(300),
  })
  .refine((v) => v.volumeMl > 0 || v.beverage === "gel", { message: "Ingresá la cantidad en ml", path: ["volumeMl"] });

export const hydrationReminderSchema = z.object({
  label: z.string().trim().min(1).max(60),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida"),
  weekdays: weekdaysFromForm,
  enabled: checkbox,
});

// ---------------------------------------------------------------------------
// Competencias
// ---------------------------------------------------------------------------

export const competitionSchema = z.object({
  name: z.string().trim().min(1, "Ingresá el nombre").max(120),
  distanceCode: z.preprocess(emptyToNull, distanceCodeSchema.nullable()),
  distanceKm: kmField(),
  eventDate: isoDateSchema,
  location: optionalText(120),
  targetTime: optionalDurationField("Tiempo objetivo"),
  notes: optionalText(1000),
});

export const competitionResultSchema = z.object({
  competitionId: z.uuid(),
  finishTime: durationField("Tiempo final"),
  isOfficial: checkbox,
  status: z.enum(["completed", "dnf", "dns"]).default("completed"),
  splits: splitsField,
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

/** Importe ingresado como "7,99" o "7.99" (sin separador de miles) → unidades menores enteras (799). */
export const moneyField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const raw = v.replace(",", ".");
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "Importe inválido (usá hasta 2 decimales)" });
      return z.NEVER;
    }
    const [i, d = ""] = raw.split(".") as [string, string?];
    return Number(i) * 100 + Number((d ?? "").padEnd(2, "0"));
  });

export const priceSchema = z.object({
  productId: z.uuid(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Moneda ISO de 3 letras"),
  amount: moneyField,
  provider: z.preprocess(emptyToNull, z.enum(["mercadopago", "stripe", "apple", "google"]).nullable()),
  providerPriceId: optionalText(120),
});

export const roleChangeSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["user", "coach", "admin"]),
  canValidatePlans: checkbox,
});

export const incidentSchema = z.object({
  category: z.enum(["bug", "content", "billing", "other"]),
  message: z.string().trim().min(5, "Contanos un poco más (mínimo 5 caracteres)").max(2000),
  pagePath: optionalText(200),
});

export const contentSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]{3,80}$/, "Usá minúsculas, números y guiones"),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(400).default(""),
  body: z.string().max(20000).default(""),
  category: z.enum(["hydration", "training", "injury_prevention", "nutrition", "general"]),
  isPremium: checkbox,
});

/** Convierte FormData en objeto; los campos repetidos (checkbox múltiples) se vuelven arrays. */
export function formDataToObject(fd: FormData, arrayFields: readonly string[] = []): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    const values = fd.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    obj[key] = arrayFields.includes(key) ? values : values[values.length - 1];
  }
  for (const f of arrayFields) if (!(f in obj)) obj[f] = [];
  return obj;
}

/** Primer mensaje de error por campo, para mostrar en formularios. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
