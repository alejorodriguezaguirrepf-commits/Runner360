/**
 * Entrenamientos principales en kilómetros en lugar de minutos.
 *
 * El contenido de los planes prescribe la parte principal en tiempo ("55' continuos en Suave",
 * "3 × 8' en Umbral, pausa 2' de trote suave"). Para mostrarla en distancia se usa la velocidad de
 * cada intensidad:
 *  - con un test reciente del corredor: su velocidad normalizada a un esfuerzo de ~30 minutos
 *    (Riegel) y las proporciones entre intensidades del corredor modelo del capítulo;
 *  - sin test: las velocidades del corredor modelo del capítulo (`model_runner_assumptions`).
 *
 * Se convierten solo los tramos de carrera de la parte principal. Quedan en minutos: pausas y
 * recuperaciones, progresivos y cuestas cortas, caminata/trote (principiantes), cambios de ritmo
 * dentro de un rodaje y los tests (que se hacen por tiempo). Un texto que no se reconoce queda igual.
 *
 * Redondeo: carrera continua a 0,5 km; pasadas de menos de 2 km a 100 m.
 */
import { RIEGEL_EXPONENT } from "./riegel";

/** Velocidad (km/h) por intensidad: walk, rec, suave, mod, umb, rp, r10, int, vel, test, r5, r3, h21. */
export type Speeds = Record<string, number>;
export type PaceTest = { distanceKm: number; timeS: number };

/** Proporciones de referencia (capítulo 2) para capítulos sin velocidad de test en el contenido. */
const REFERENCE_KMH: Speeds = { rec: 8.5, suave: 9.5, mod: 10.5, umb: 11.0, r10: 11.3, int: 11.8, vel: 13.0, test: 11.2, r5: 11.8, r3: 12.3 };

/** Velocidades del corredor modelo del capítulo (`chapterN_kmh`), o null si el contenido no las tiene. */
export function modelSpeeds(assumptions: Record<string, unknown> | null | undefined, chapter: number): Speeds | null {
  const raw = assumptions?.[`chapter${chapter}_kmh`];
  if (!raw || typeof raw !== "object") return null;
  const out: Speeds = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "number" && v > 0) out[k] = v;
  return Object.keys(out).length ? out : null;
}

/** Velocidad (km/h) equivalente a un esfuerzo de 30 minutos, a partir de un test de cualquier duración (Riegel). */
export function speed30FromTest(test: PaceTest): number {
  if (!(test.distanceKm > 0) || !(test.timeS > 0)) throw new Error("Test inválido");
  const d30 = test.distanceKm * Math.pow(1800 / test.timeS, 1 / RIEGEL_EXPONENT);
  return d30 * 2;
}

/**
 * Velocidades del corredor: las del modelo escaladas a su test (si hay). La caminata no se escala.
 * El 100 % del test equivale a la intensidad "test" del modelo (esfuerzo máximo sostenible ~30').
 */
export function runnerSpeeds(model: Speeds, test: PaceTest | null): Speeds {
  if (!test) return { ...model };
  const v30 = speed30FromTest(test);
  const base = model.test ? model : REFERENCE_KMH;
  const out: Speeds = {};
  for (const [k, v] of Object.entries(base)) if (k !== "walk") out[k] = v30 * (v / base.test!);
  if (model.walk) out.walk = model.walk;
  return out;
}

// ---------------------------------------------------------------- Texto

const TIME = String.raw`(\d+h\d{2}'|\d+'(?:\d{2}")?|\d+")`;

/** "55'" → 3300 s; "1h20'" → 4800; "1'30\"" → 90; "20\"" → 20. */
export function parseContentTime(t: string): number | null {
  let m = /^(\d+)h(\d{2})'$/.exec(t);
  if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60;
  m = /^(\d+)'(?:(\d{2})")?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d+)"$/.exec(t);
  return m ? Number(m[1]) : null;
}

/** Intensidad de un tramo según cómo la nombra el contenido. */
export function intensityOf(text: string): string | null {
  const t = text.toLowerCase();
  if (/ritmo (objetivo )?de 3[–-]5 km|ritmo de 5[–-]10 km/.test(t)) return "int";
  if (/ritmo (objetivo )?de 3 km/.test(t)) return "r3";
  if (/ritmo (objetivo )?de 5 km/.test(t)) return "r5";
  if (/ritmo (objetivo )?de 10 km/.test(t)) return "r10";
  if (/ritmo (objetivo )?de 21,1 km|media marat/.test(t)) return "h21";
  if (/marat[oó]n/.test(t)) return "rp";
  if (/muy suave|recuperaci[oó]n/.test(t)) return "rec";
  if (/umbral/.test(t)) return "umb";
  if (/moderado/.test(t)) return "mod";
  if (/intenso/.test(t)) return "int";
  if (/velocidad/.test(t)) return "vel";
  if (/suave/.test(t)) return "suave";
  return null;
}

const FALLBACK: Record<string, string[]> = { r3: ["int", "vel"], r5: ["int"], r10: ["int", "umb"], h21: ["rp", "umb"], rp: ["mod", "umb"] };

function speedFor(speeds: Speeds, key: string | null): number | null {
  if (!key) return null;
  for (const k of [key, ...(FALLBACK[key] ?? [])]) if (speeds[k]) return speeds[k];
  return null;
}

const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** Carrera continua: múltiplos de 0,5 km (mínimo 0,5). */
export function roundHalfKm(km: number): number {
  return Math.max(0.5, Math.round(km * 2) / 2);
}

/** "9 km", "7,5 km". */
export function formatKmShort(km: number): string {
  return `${decimal.format(km)} km`;
}

/** Pasada: menos de 2 km → a 100 m ("400 m", "1,3 km"); desde 2 km → a 0,5 km. */
export function formatRepDistance(km: number): string {
  if (km >= 2) return formatKmShort(roundHalfKm(km));
  const m = Math.max(100, Math.round((km * 1000) / 100) * 100);
  return m < 1000 ? `${m} m` : formatKmShort(m / 1000);
}

const kmOf = (seconds: number, kmh: number) => (seconds / 3600) * kmh;

/** No se convierten: tests, caminata/trote, cuestas, cambios de ritmo dentro de un rodaje. */
const SKIP = /test|caminata|subida|desde el minuto|\(\d+' trote/i;

/**
 * Parte principal con los tramos de carrera en km. Devuelve el texto original si no lo reconoce o
 * si falta la velocidad de la intensidad.
 */
export function mainSetInKm(text: string | null | undefined, speeds: Speeds | null): string | null | undefined {
  if (!text || !speeds || SKIP.test(text)) return text;

  // "1h20': primeros 1h10' en Suave y últimos 10' en Moderado"
  let m = new RegExp(String.raw`^${TIME}: primeros ${TIME} en (.+?) y últimos ${TIME} en (.+)$`).exec(text);
  if (m) {
    const [, , t1, i1, t2, i2] = m;
    const s1 = speedFor(speeds, intensityOf(i1!));
    const s2 = speedFor(speeds, intensityOf(i2!));
    const sec1 = parseContentTime(t1!);
    const sec2 = parseContentTime(t2!);
    if (!s1 || !s2 || sec1 === null || sec2 === null) return text;
    const k1 = roundHalfKm(kmOf(sec1, s1));
    const k2 = roundHalfKm(kmOf(sec2, s2));
    return `${formatKmShort(k1 + k2)}: primeros ${formatKmShort(k1)} en ${i1} y últimos ${formatKmShort(k2)} en ${i2}`;
  }

  // "3 × 8' en Umbral, pausa 2' de trote suave"
  m = new RegExp(String.raw`^(\d+) × ${TIME} (.+)$`).exec(text);
  if (m) {
    const [, reps, t, rest] = m;
    const sec = parseContentTime(t!);
    const work = rest!.split(",")[0]!;
    const s = speedFor(speeds, intensityOf(work));
    if (sec === null || sec < 60 || !s) return text;
    return `${reps} × ${formatRepDistance(kmOf(sec, s))} ${rest}`;
  }

  // "55' continuos en Suave", "25' en Suave; al final, …", "35' de trote muy suave", "20' trote continuo Suave"
  m = new RegExp(String.raw`^${TIME}( .+)$`).exec(text);
  if (m) {
    const [, t, rest] = m;
    const sec = parseContentTime(t!);
    const first = rest!.split(";")[0]!;
    const s = speedFor(speeds, intensityOf(first));
    if (sec === null || sec < 5 * 60 || !s) return text;
    return `${formatKmShort(roundHalfKm(kmOf(sec, s)))}${rest}`;
  }
  return text;
}
