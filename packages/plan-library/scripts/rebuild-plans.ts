// Genera la versión 2026.11 de la biblioteca a partir de la 2026.10.1 (revisión completa de planes).
//
// Reglas (ver src/quality-rules.ts y docs/plan-audit/):
//  1. Ninguna sesión de calidad se repite igual en semanas consecutivas: si queda igual, progresa
//     (una pasada más en semanas de carga, una menos en descargas y puesta a punto).
//  2. Pasadas solo de 100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000 o 5000 m: se
//     elige la distancia de la lista y la cantidad de pasadas que mantienen el volumen de la sesión.
//  3. Nada de velocidad en segundos: progresivos y cuestas pasan a metros. Pausas en tiempo; entrada
//     en calor y vuelta a la calma pueden seguir en minutos.
//  4. Intermedio (decisión del dueño, no de la bibliografía): ~20–25 % más km semanales, 2 sesiones de
//     calidad por semana de carga y 3 en las semanas pico (tirada larga con tramos a ritmo en el bloque
//     específico) y más volumen de pasadas. Se mantienen descargas y puesta a punto.
//  5. Parte principal en km; intensidades con su porcentaje (100 % = ritmo del test de 5 km), igual
//     que en la Calculadora.
//
// Los km se calculan con el corredor modelo de cada capítulo (model_runner_assumptions); duración,
// minutos por intensidad, totales semanales, rangos de fase y validaciones se recalculan.
//
// Uso: pnpm --filter @runner360/plan-library rebuild <json 2026.10.1> [salida]
//   La entrada se obtiene del historial: git show a74eb2d:content/training-plans/running_plans_library.json
import { readFileSync, writeFileSync } from "node:fs";
import { intensityOf, modelSpeeds, parseContentTime, type Speeds } from "../src/distance";
import { formatMinutes } from "../src/format";
import { checkInvariants, isDemanding, isSession, raceWeekOf } from "../src/invariants";
import { ALLOWED_REP_METERS, averageWeeklyKm, checkQualityRules } from "../src/quality-rules";
import { EASY_SIGNAL, LEGACY_EASY_SIGNAL } from "../src/rules";
import { parseBlock } from "../src/session-blocks";
import { librarySchema, type Library, type LibraryDay, type LibraryPlan, type LibrarySessionDay, type LibraryWeek } from "../src/schema";
import { LIBRARY_JSON } from "./paths";

export const NEW_VERSION = "2026.12";
const SOURCE_VERSION = "2026.10.1";

// ---------------------------------------------------------------- Velocidades e intensidades

/** Proporciones del capítulo 2: se usan para los porcentajes del capítulo 1 (sin test máximo). */
/**
 * Porcentaje de la velocidad del test por intensidad (decisión del dueño, 2026.12): ritmos
 * coherentes con la Calculadora y con la tabla de RPE. Caminata 50 · trote muy liviano 60 ·
 * carrera continua 70 · cambios y tramos finales 80 · ritmo de maratón 85 · media maratón y
 * pasadas largas 90 · ritmo de 10 km 95 · ritmo de 5 km, test y cuestas 100 · ritmo de 3 km 105 ·
 * aceleraciones de 100 m 115.
 */
export const PCT: Record<string, number> = { walk: 50, rec: 60, suave: 70, mod: 80, umb: 90, h21: 90, r10: 95, test: 100, r5: 100, int: 100, hills: 100, r3: 105, vel: 115 };
const FALLBACK: Record<string, string[]> = { r3: ["int", "vel"], r5: ["int"], r10: ["int", "umb"], h21: ["rp", "umb"], rp: ["mod", "umb"] };

class Ctx {
  readonly sp: Speeds;
  constructor(
    lib: Library,
    readonly chapter: number,
  ) {
    this.sp = modelSpeeds(lib.model_runner_assumptions, chapter) ?? {};
  }
  speed(key: string, table: Speeds = this.sp): number {
    for (const k of [key, ...(FALLBACK[key] ?? [])]) if (table[k]) return table[k]!;
    throw new Error(`capítulo ${this.chapter}: sin velocidad para "${key}"`);
  }
  /** Porcentaje de la velocidad del test (PCT, calibrado a la tabla de RPE de src/rpe-scale.json). */
  pct(key: string): number {
    if (key === "rp") return this.chapter === 4 ? 85 : 90;
    for (const k of [key, ...(FALLBACK[key] ?? [])]) if (PCT[k] !== undefined) return PCT[k]!;
    throw new Error(`sin porcentaje para "${key}"`);
  }
  nameOf(key: string): string {
    if (key === "walk" || key === "rec") return "Recuperación";
    if (key === "suave") return "Suave";
    if (key === "mod") return "Moderado";
    if (key === "umb" || key === "test" || key === "h21") return "Umbral";
    if (key === "rp") return this.chapter === 4 ? "Moderado" : "Umbral";
    if (key === "vel") return "Velocidad";
    return "Intenso";
  }
}

type Seg = { name: string | null; km: number; min: number };

function seg(ctx: Ctx, key: string, v: { km?: number; min?: number }): Seg {
  const s = ctx.speed(key);
  const km = v.km ?? ((v.min ?? 0) * s) / 60;
  const min = v.min ?? (km / s) * 60;
  return { name: ctx.nameOf(key), km, min };
}
const other = (min: number): Seg => ({ name: null, km: 0, min });

// ---------------------------------------------------------------- Formato

const dec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const dec1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKm = (km: number) => `${dec.format(km)} km`;
const fmtRep = (m: number) => (m < 2000 ? `${m} m` : fmtKm(m / 1000));
const r05 = (km: number) => Math.max(0.5, Math.round(km * 2) / 2);
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const TIME = String.raw`(\d+h\d{2}'|\d+'(?:\d{2}")?|\d+")`;
const sec = (t: string) => {
  const s = parseContentTime(t);
  if (s === null) throw new Error(`tiempo inválido "${t}"`);
  return s;
};

/** " al 90 %": la intensidad de un tramo (gramática de src/session-blocks.ts). */
const at = (ctx: Ctx, key: string) => ` al ${ctx.pct(key)} %`;

/** Tiempo del contenido → texto: "2'" → "2 min", "1'40\"" → "1 min 40 s", "40\"" → "40 s". */
export function fmtTime(t: string): string {
  const total = sec(t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", s ? `${s} s` : ""].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- Pasadas

/** Distancia de la lista y cantidad de pasadas que mejor conservan el volumen (y el largo de la pasada). */
export function snapReps(volumeM: number, origM: number, minN = 2, maxN = 30): { n: number; m: number } {
  let best = { n: minN, m: ALLOWED_REP_METERS[0] as number, cost: Infinity };
  for (const m of ALLOWED_REP_METERS) {
    const n = Math.min(maxN, Math.max(minN, Math.round(volumeM / m)));
    const cost = Math.abs(n * m - volumeM) / volumeM + 0.3 * Math.abs(Math.log(m / origM));
    if (cost < best.cost) best = { n, m, cost };
  }
  return { n: best.n, m: best.m };
}

/** Distancia de la lista más cercana (en proporción). */
export function nearestAllowed(m: number, options: readonly number[] = ALLOWED_REP_METERS): number {
  return options.reduce((a, b) => (Math.abs(Math.log(b / m)) < Math.abs(Math.log(a / m)) ? b : a));
}

// ---------------------------------------------------------------- Parte principal

type Main =
  | { t: "cont"; km: number; key: string; phrase: string }
  | { t: "strides"; km: number; n: number; rec: string }
  | { t: "two"; km1: number; w1: string; k1: string; km2: number; w2: string; k2: string }
  | { t: "tramos"; a: number; n: number; m: number; work: string; key: string; pause: string; c: number }
  | { t: "reps"; n: number; m: number; work: string; key: string; pause: string }
  | { t: "hills"; n: number; m: number; slope: string }
  | { t: "cr"; km: number; from: number; n: number; m: number; work: string; rec: string }
  | { t: "walkrun"; n: number; m: number; walk: string }
  | { t: "rwr"; km1: number; walk: string; km2: number }
  | { t: "walk"; km: number }
  | { t: "test1"; km: number }
  | { t: "testmax"; km: number }
  | { t: "race"; text: string; km: number; name: string; min: number };

const kmOfTime = (ctx: Ctx, t: string, key: string) => (sec(t) / 3600) * ctx.speed(key);
const metersOfTime = (ctx: Ctx, t: string, key: string) => kmOfTime(ctx, t, key) * 1000;
const kmNum = (s: string) => Number(s.replace(",", "."));

/** Convierte la parte principal del contenido 2026.10.1 a la forma estructurada (y a distancia). */
export function parseMain(ctx: Ctx, d: LibrarySessionDay): Main {
  const s = d.main_set;
  let m: RegExpExecArray | null;
  const re = (p: string) => new RegExp(`^${p}$`).exec(s);

  if ((m = re(String.raw`(\d+)' caminata a paso vivo`))) return { t: "walk", km: r05(kmOfTime(ctx, `${m[1]}'`, "walk")) };
  if ((m = re(String.raw`(\d+) × \((\d+)' trote \+ ${TIME} caminata\)`))) {
    const n = Number(m[1]);
    return { t: "walkrun", n, m: nearestAllowed(metersOfTime(ctx, `${m[2]}'`, "suave")), walk: m[3]! };
  }
  if ((m = re(String.raw`(\d+)' trote \+ ${TIME} caminata \+ (\d+)' trote`)))
    return { t: "rwr", km1: r05(kmOfTime(ctx, `${m[1]}'`, "suave")), walk: m[2]!, km2: r05(kmOfTime(ctx, `${m[3]}'`, "suave")) };
  if ((m = re(String.raw`(\d+)' trote continuo Suave`))) return { t: "cont", km: r05(kmOfTime(ctx, `${m[1]}'`, "suave")), key: "suave", phrase: "de trote continuo Suave" };
  if ((m = re(String.raw`(\d+)' (?:de )?trote muy suave`))) return { t: "cont", km: r05(kmOfTime(ctx, `${m[1]}'`, "rec")), key: "rec", phrase: "de trote muy suave" };
  if ((m = re(String.raw`Test: (\d+)' de trote continuo Suave, sin pausas`))) return { t: "test1", km: r05(kmOfTime(ctx, `${m[1]}'`, "suave")) };
  if ((m = re(String.raw`Test de (\d+)' a la máxima intensidad sostenible \(ritmo parejo\)`))) return { t: "testmax", km: 5 };
  if ((m = re(String.raw`(\d+)' de trote Suave; desde el minuto (\d+), (\d+) × ${TIME} (en Moderado|en ritmo de carrera \(Moderado\)) con (\d+')(?: de trote Suave entre cada uno)`))) {
    return {
      t: "cr",
      km: r05(kmOfTime(ctx, `${m[1]}'`, "suave")),
      from: Math.max(0.5, r05(kmOfTime(ctx, `${m[2]}'`, "suave"))),
      n: Number(m[3]),
      m: nearestAllowed(metersOfTime(ctx, m[4]!, "mod"), [100, 200, 300, 400, 500]),
      work: m[5]!,
      rec: m[6]!,
    };
  }
  if ((m = re(String.raw`${TIME} continuos en (Suave|Umbral)`))) {
    const key = m[2] === "Suave" ? "suave" : "umb";
    return { t: "cont", km: r05(kmOfTime(ctx, m[1]!, key)), key, phrase: `continuos en ${m[2]}` };
  }
  if ((m = re(String.raw`(\d+) km continuos en Suave`))) return { t: "cont", km: Number(m[1]), key: "suave", phrase: "continuos en Suave" };
  if ((m = re(String.raw`(\d+(?:,\d+)?) km continuos (a ritmo objetivo de .+)`))) {
    const key = intensityOf(m[2]!)!;
    return { t: "cont", km: kmNum(m[1]!), key, phrase: `continuos ${m[2]}` };
  }
  if ((m = re(String.raw`${TIME} en Suave; al final, (\d+) × 20" progresivos \(Velocidad\) con ${TIME} de trote suave`)))
    return { t: "strides", km: r05(kmOfTime(ctx, m[1]!, "suave")), n: Number(m[2]), rec: m[3]! };
  if ((m = re(String.raw`${TIME}: primeros ${TIME} en Suave y últimos ${TIME} en Moderado`)))
    return { t: "two", km1: r05(kmOfTime(ctx, m[2]!, "suave")), w1: "en Suave", k1: "suave", km2: r05(kmOfTime(ctx, m[3]!, "mod")), w2: "en Moderado", k2: "mod" };
  if ((m = re(String.raw`(\d+) km: los primeros (\d+) km en Suave y los últimos (\d+) km (a ritmo objetivo de maratón)`)))
    return { t: "two", km1: Number(m[2]), w1: "en Suave", k1: "suave", km2: Number(m[3]), w2: m[4]!, k2: "rp" };
  if ((m = re(String.raw`(\d+) km: (\d+) km en Suave \+ (\d+) × (\d+) km (a ritmo objetivo de maratón) \(pausa ${TIME} de trote suave\) \+ (\d+) km en Suave`)))
    return { t: "tramos", a: Number(m[2]), ...snapReps(Number(m[3]) * Number(m[4]) * 1000, Number(m[4]) * 1000), work: m[5]!, key: "rp", pause: m[6]!, c: Number(m[7]) };
  if ((m = re(String.raw`(\d+) × ${TIME} en subida \(pendiente (.+?)\), vuelta caminando o trotando al punto de partida`)))
    return { t: "hills", n: Number(m[1]), m: nearestAllowed(metersOfTime(ctx, m[2]!, "int") * 0.85, [100, 200, 300]), slope: m[3]! };
  if ((m = re(String.raw`(\d+) × (?:(\d+(?:,\d+)?) (m|km)|${TIME}) (.+?), pausa ${TIME} de trote suave`))) {
    const n = Number(m[1]);
    const work = m[5]!;
    const key = intensityOf(work);
    if (!key) throw new Error(`intensidad desconocida en "${s}"`);
    const meters = m[2] ? kmNum(m[2]) * (m[3] === "km" ? 1000 : 1) : metersOfTime(ctx, m[4]!, key);
    const snapped = snapReps(n * meters, meters);
    return { t: "reps", ...snapped, work, key, pause: m[6]! };
  }
  if ((m = re(String.raw`(\d+(?:,\d+)?) km(?::| \().+`))) {
    // Competencias y controles por distancia: el texto queda igual (km y minutos del contenido).
    const name = (["Moderado", "Umbral", "Intenso"] as const).reduce((a, b) => ((d.minutes_by_intensity[b] ?? 0) > (d.minutes_by_intensity[a] ?? 0) ? b : a));
    return { t: "race", text: s, km: kmNum(m[1]!), name, min: d.minutes_by_intensity[name] ?? 0 };
  }
  throw new Error(`parte principal no reconocida: "${s}"`);
}

export function renderMain(ctx: Ctx, x: Main): string {
  const suave = at(ctx, "suave");
  switch (x.t) {
    case "cont":
      return `${fmtKm(x.km)}${at(ctx, x.key)}`;
    case "strides":
      return `${fmtKm(x.km)}${suave} + al final: ${x.n} × 100 m${at(ctx, "vel")}, pausa ${fmtTime(x.rec)} trotando`;
    case "two":
      return `${fmtKm(x.km1 + x.km2)}: ${fmtKm(x.km1)}${at(ctx, x.k1)} + ${fmtKm(x.km2)}${at(ctx, x.k2)}`;
    case "tramos":
      return `${fmtKm(x.a + (x.n * x.m) / 1000 + x.c)}: ${fmtKm(x.a)}${suave} + ${x.n} × ${fmtRep(x.m)}${at(ctx, x.key)}, pausa ${fmtTime(x.pause)} trotando + ${fmtKm(x.c)}${suave}`;
    case "reps":
      return `${x.n} × ${fmtRep(x.m)}${at(ctx, x.key)}, pausa ${fmtTime(x.pause)} trotando`;
    case "hills":
      return `${x.n} × ${x.m} m en subida (pendiente ${x.slope.replace(/%$/, " %")})${at(ctx, "hills")}, vuelta caminando al punto de partida`;
    case "cr":
      return `${fmtKm(x.km)}${suave} + desde el km ${dec.format(x.from)}: ${x.n} × ${x.m} m${at(ctx, "mod")}, pausa ${fmtTime(x.rec)} trotando`;
    case "walkrun":
      return `${x.n} × ${x.m} m${suave}, pausa ${fmtTime(x.walk)} caminando`;
    case "rwr":
      return `${fmtKm(x.km1)}${suave} + ${fmtTime(x.walk)} caminando${at(ctx, "walk")} + ${fmtKm(x.km2)}${suave}`;
    case "walk":
      return `${fmtKm(x.km)} caminando${at(ctx, "walk")}`;
    case "test1":
      return `Test: ${fmtKm(x.km)}${suave}, sin pausas`;
    case "testmax":
      return `Test: ${fmtKm(x.km)}${at(ctx, "test")}, a la máxima intensidad sostenible y con ritmo parejo`;
    case "race":
      return renderRace(x);
  }
}

/** Distancia de la competencia tal cual el contenido ("42,195 km"). */
const raceDistance = (x: Extract<Main, { t: "race" }>) => /^\d+(?:,\d+)? km/.exec(x.text)![0];

/** Competencias y controles por distancia: "Competencia: 10 km al 95 %". */
function renderRace(x: Extract<Main, { t: "race" }>): string {
  if (/^5 km: primeros/.test(x.text)) return "Competencia: 5 km al 75 %, los primeros 2 km más tranquilos y el último según sensaciones";
  const m = /^\d+(?:,\d+)? km \((objetivo|intermedia|control): (.+)\)$/.exec(x.text);
  if (!m) throw new Error(`competencia no reconocida: "${x.text}"`);
  const label = m[1] === "objetivo" ? "Competencia" : m[1] === "intermedia" ? "Competencia intermedia" : "Control";
  const controlled = /controlada|Moderado–Umbral/.test(m[2]!);
  const pct = controlled ? 85 : x.km <= 5 ? 100 : x.km <= 10 ? 95 : x.km <= 21.1 ? 90 : 85;
  return `${label}: ${raceDistance(x)} al ${pct} %${controlled ? ", sin ir al máximo" : ""}`;
}

function mainSegs(ctx: Ctx, x: Main): Seg[] {
  const pauses = (n: number, pause: string) => seg(ctx, "rec", { min: ((n - 1) * sec(pause)) / 60 });
  switch (x.t) {
    case "cont":
      return [seg(ctx, x.key, { km: x.km })];
    case "strides":
      return [seg(ctx, "suave", { km: x.km - x.n * 0.1 }), seg(ctx, "vel", { km: x.n * 0.1 })];
    case "two":
      return [seg(ctx, x.k1, { km: x.km1 }), seg(ctx, x.k2, { km: x.km2 })];
    case "tramos":
      return [seg(ctx, "suave", { km: x.a + x.c }), seg(ctx, x.key, { km: (x.n * x.m) / 1000 }), pauses(x.n, x.pause)];
    case "reps":
      return [seg(ctx, x.key, { km: (x.n * x.m) / 1000 }), pauses(x.n, x.pause)];
    case "hills": {
      const km = (x.n * x.m) / 1000;
      const min = (km / (ctx.speed("int") * 0.85)) * 60;
      return [{ name: "Intenso", km, min }, { name: "Recuperación", km, min: 2 * min }];
    }
    case "cr":
      return [seg(ctx, "suave", { km: x.km - (x.n * x.m) / 1000 }), seg(ctx, "mod", { km: (x.n * x.m) / 1000 })];
    case "walkrun":
      return [seg(ctx, "suave", { km: (x.n * x.m) / 1000 }), seg(ctx, "walk", { min: (x.n * sec(x.walk)) / 60 })];
    case "rwr":
      return [seg(ctx, "suave", { km: x.km1 + x.km2 }), seg(ctx, "walk", { min: sec(x.walk) / 60 })];
    case "walk":
      return [seg(ctx, "walk", { km: x.km })];
    case "test1":
      return [seg(ctx, "suave", { km: x.km })];
    case "testmax":
      return [seg(ctx, "test", { km: x.km })];
    case "race":
      return [{ name: x.name, km: x.km, min: x.min }];
  }
}

/** Km principales (para la etiqueta corta y los requisitos). */
export function mainKm(x: Main): number {
  switch (x.t) {
    case "cont":
    case "strides":
    case "walk":
    case "test1":
    case "testmax":
    case "race":
    case "cr":
      return x.km;
    case "two":
      return x.km1 + x.km2;
    case "tramos":
      return x.a + (x.n * x.m) / 1000 + x.c;
    case "rwr":
      return x.km1 + x.km2;
    case "reps":
    case "hills":
    case "walkrun":
      return (x.n * x.m) / 1000;
  }
}

/** Etiqueta corta (lista de la semana): solo distancias o repeticiones, sin nombres de esfuerzo. */
function shortLabel(x: Main): string {
  switch (x.t) {
    case "reps":
      return `${x.n} × ${fmtRep(x.m)}`;
    case "hills":
      return `${x.n} × ${x.m} m en subida`;
    case "walkrun":
      return `${x.n} × ${x.m} m + caminata`;
    case "strides":
      return `${fmtKm(x.km)} + ${x.n} × 100 m`;
    case "tramos":
      return `${fmtKm(mainKm(x))} con ${x.n} × ${fmtRep(x.m)}`;
    case "cr":
      return `${fmtKm(x.km)} con cambios`;
    case "walk":
      return `${fmtKm(x.km)} caminando`;
    case "test1":
    case "testmax":
      return `Test ${fmtKm(x.km)}`;
    case "race":
      return `${/^Control/.test(renderRace(x)) ? "Control" : "Competencia"} ${raceDistance(x)}`;
    default:
      return fmtKm(mainKm(x));
  }
}

/** Nombre de la sesión según su estructura (sin nombres de esfuerzo). */
function sessionType(code: string, x: Main): string {
  if (x.t === "race") return /^Control/.test(renderRace(x)) ? "Control" : "Competencia";
  if (x.t === "test1" || x.t === "testmax") return "Test";
  if (x.t === "hills") return "Cuestas";
  if (x.t === "walk") return "Caminata";
  if (x.t === "walkrun" || x.t === "rwr") return "Caminar y trotar";
  if (x.t === "cr") return "Carrera con cambios";
  if (x.t === "reps") return "Pasadas";
  if (x.t === "tramos" || x.t === "two") return "Carrera larga con tramos";
  return code === "TL" || code === "RM" ? "Carrera larga" : "Carrera continua";
}

/** Notas y criterios sin nombres de esfuerzo (la intensidad va en porcentaje y RPE). */
const PLAIN_TEXT: [RegExp, string][] = [
  [/ El Umbral queda cerca de ese ritmo\./g, ""],
  [/a fondo controlado/g, "con esfuerzo alto y controlado"],
  [/carrera a fondo/g, "carrera al máximo"],
  [/sin salir a fondo/g, "sin salir al máximo"],
  [/terminar(lo)? en Suave/g, "terminar$1 al 70 %"],
  [/terminar la tirada en Suave/g, "terminar al 70 %"],
  [/ en esta tirada/g, ""],
  [/Tirada larga:/g, "Carrera larga:"],
  [/Tirada larga terminada/g, "Carrera larga terminada"],
  [/Primera tirada/g, "Primera carrera"],
  [/(la|una) tirada larga/g, "$1 carrera larga"],
  [/la tirada de/g, "la carrera de"],
  [/bicicleta suave/g, "bicicleta tranquila"],
  [/suave, sin cansarse/g, "cómoda, sin cansarse"],
  [/Los progresivos son rápidos pero relajados; técnica antes que velocidad\./g, "Los 100 m son rápidos pero relajados: primero la técnica."],
  [/Más lento que el rodaje\./g, "Más lento que una carrera continua normal."],
  [/a ritmo de maratón/g, "al 85 %"],
  [/supera 75'/g, "dura más de 75 min"],
  [/rodajes en RPE ≤4/g, "carreras continuas en RPE ≤4"],
  [/Rodajes cómodos/g, "Carreras continuas cómodas"],
  [/quitar el rodaje más largo/g, "quitar la carrera continua más larga"],
  [/solo con Suave o descanso/g, "solo con carreras al 70 % o descanso"],
  [/alargar la recuperación/g, "alargar el descanso"],
];
export const plainText = (t: string) => PLAIN_TEXT.reduce((a, [re, to]) => a.replace(re, to), t);

// ---------------------------------------------------------------- Entrada en calor / vuelta a la calma

/** Partes "N' …" separadas por " + ", con su porcentaje. Los progresivos de 20" pasan a 100 m. */
export function convertWarm(ctx: Ctx, text: string): { text: string; segs: Seg[] } {
  const parts = text.split(" + ");
  const segs: Seg[] = [];
  const out = parts.map((p) => {
    let m: RegExpExecArray | null;
    if ((m = /^(\d+) × 20" progresivos( \(pausa (\d+")\))?$/.exec(p))) {
      const n = Number(m[1]);
      segs.push(seg(ctx, "vel", { km: n * 0.1 }));
      if (m[3]) segs.push(seg(ctx, "rec", { min: (n * sec(m[3])) / 60 }));
      return `${n} × 100 m${at(ctx, "vel")}${m[3] ? `, pausa ${fmtTime(m[3])}` : ""}`;
    }
    if (!(m = /^(\d+)' (.+)$/.exec(p))) throw new Error(`entrada en calor no reconocida: "${text}"`);
    const min = Number(m[1]);
    const what = m[2]!;
    if (/^(en )?Recuperación$|^trote muy suave$/.test(what)) {
      segs.push(seg(ctx, "rec", { min }));
      return `${min} min${at(ctx, "rec")}`;
    }
    if (what === "trote muy suave o caminata") {
      segs.push(seg(ctx, "rec", { min }));
      return `${min} min${at(ctx, "rec")} (trote o caminata)`;
    }
    if (what === "Suave") {
      segs.push(seg(ctx, "suave", { min }));
      return `${min} min${at(ctx, "suave")}`;
    }
    if (/^caminata( suave)?$/.test(what)) {
      segs.push(seg(ctx, "walk", { min }));
      return `${min} min caminando${at(ctx, "walk")}`;
    }
    if (/^(movilidad( y técnica)?|estiramientos)$/.test(what)) {
      segs.push(other(min));
      return `${min} min de ${what}`;
    }
    throw new Error(`parte no reconocida: "${p}"`);
  });
  return { text: out.join(" + "), segs };
}

// ---------------------------------------------------------------- Modelo de trabajo

type WDay = { day: LibrarySessionDay; main: Main; orig: string; changed: boolean };
type WWeek = { week: LibraryWeek; days: (WDay | null)[] };
type WPlan = { plan: LibraryPlan; weeks: WWeek[]; ctx: Ctx };

const DELOAD = new Set(["D", "DC", "DCOMP", "DCT"]);
const isLoad = (w: LibraryWeek) => w.week_type === "L";
const phaseKind = (phase: string): "base" | "dev" | "spec" | "taper" =>
  /puesta a punto/i.test(phase) ? "taper" : /espec[ií]fic|polarizad/i.test(phase) ? "spec" : /desarrollo/i.test(phase) ? "dev" : "base";

function load(lib: Library, plan: LibraryPlan): WPlan {
  const ctx = new Ctx(lib, plan.chapter);
  return {
    plan,
    ctx,
    weeks: plan.weeks.map((week) => ({
      week,
      days: week.days.map((d) => (isSession(d) ? { day: structuredClone(d), main: parseMain(ctx, d), orig: d.main_set, changed: false } : null)),
    })),
  };
}

// ---------------------------------------------------------------- Intermedio: más volumen y calidad

/** Plantillas (entrada en calor, notas…) tomadas del propio capítulo para las sesiones agregadas. */
function template(lib: Library, chapter: number, code: string, pick?: (d: LibrarySessionDay) => boolean): LibrarySessionDay {
  for (const p of lib.plans.filter((x) => x.chapter === chapter))
    for (const w of p.weeks) for (const d of w.days) if (isSession(d) && d.code === code && (!pick || pick(d))) return d;
  throw new Error(`sin plantilla ${code} en el capítulo ${chapter}`);
}

const INSERT_SEQ: Record<string, [number, number][]> = {
  CUE: [[8, 200], [10, 200], [12, 200], [8, 300], [10, 300], [12, 300]],
  UMB: [[5, 1000], [4, 1500], [6, 1000], [3, 2000], [7, 1000], [5, 1500], [4, 2000]],
  INT: [[8, 400], [6, 600], [5, 800], [10, 400], [6, 800], [5, 1000], [6, 1000]],
  RC: [[5, 1000], [4, 1500], [3, 2000], [6, 1000], [4, 2000]],
};
const TRAMOS_SEQ: [number, number][] = [[3, 1000], [4, 1000], [5, 1000], [3, 1500], [4, 1500], [3, 2000]];

function dayAt(wp: WPlan, w: number, i: number): LibraryDay | null {
  if (i < 0) return w > 0 ? dayAt(wp, w - 1, i + 7) : null;
  if (i > 6) return w < wp.weeks.length - 1 ? dayAt(wp, w + 1, i - 7) : null;
  const wd = wp.weeks[w]!.days[i];
  return wd ? wd.day : wp.weeks[w]!.week.days[i]!;
}

function boostIntermediate(lib: Library, wp: WPlan, f: number): void {
  const { ctx } = wp;
  // 1) Volumen: rodajes y tiradas ×f; pasadas ×1,2.
  for (const w of wp.weeks)
    for (const wd of w.days) {
      if (!wd) continue;
      const x = wd.main;
      if (x.t === "cont") x.km = r05(x.km * (x.key === "umb" ? 1.2 : f));
      else if (x.t === "strides") x.km = r05(x.km * f);
      else if (x.t === "two") {
        x.km1 = r05(x.km1 * f);
        x.km2 = r05(x.km2 * f);
      } else if (x.t === "reps") Object.assign(x, snapReps(x.n * x.m * 1.2, x.m));
      else if (x.t === "hills") x.n = Math.round(x.n * 1.2);
      else continue;
      wd.changed = true;
    }

  // 2) Dos sesiones de calidad en cada semana de carga (tres en las semanas pico).
  const used: Record<string, number> = {};
  let tramos = 0;
  wp.weeks.forEach((w, wi) => {
    if (!isLoad(w.week)) return;
    const kind = phaseKind(w.week.phase);
    const quality = () => w.days.filter((d) => d?.day.is_quality);
    while (quality().length < 2) {
      const candidates = w.days
        .map((wd, i) => ({ wd, i }))
        .filter(({ wd, i }) => wd && !wd.day.is_quality && (wd.day.code === "R" || wd.day.code === "R+P") && !isDemanding(dayAt(wp, wi, i - 1)!) && !isDemanding(dayAt(wp, wi, i + 1)!));
      if (!candidates.length) break;
      // El que queda más lejos de las otras sesiones exigentes.
      const gap = (i: number) => {
        let best = 7;
        for (let k = 1; k <= 7; k++) if ([dayAt(wp, wi, i - k), dayAt(wp, wi, i + k)].some((d) => d && isDemanding(d))) return k;
        return best;
      };
      // Mejor no el día antes de la tirada larga; después, el más alejado de las otras exigentes.
      const beforeLong = (i: number) => (dayAt(wp, wi, i + 1) as LibrarySessionDay | null)?.code === "TL";
      const { wd, i } = candidates.sort((a, b) => Number(beforeLong(a.i)) - Number(beforeLong(b.i)) || gap(b.i) - gap(a.i) || a.i - b.i)[0]!;
      const present = new Set(quality().map((q) => q!.day.code));
      const order =
        kind === "base" ? ["CUE", "UMB", "INT"] : kind === "dev" ? (present.has("UMB") ? ["INT", "CUE"] : ["UMB", "INT"]) : ["UMB", "INT"];
      const code = order.find((c) => !present.has(c)) ?? order[0]!;
      const k = used[code] ?? 0;
      used[code] = k + 1;
      const seq = INSERT_SEQ[code]!;
      const [n, m] = seq[Math.min(k, seq.length - 1)]!;
      const tpl = template(lib, ctx.chapter, code, code === "INT" ? (d) => /ritmo de 3[–-]5 km/.test(d.main_set) : undefined);
      const main: Main =
        code === "CUE"
          ? { t: "hills", n, m, slope: "4–6%" }
          : code === "UMB"
            ? { t: "reps", n, m, work: "en Umbral", key: "umb", pause: "2'" }
            : code === "INT"
              ? { t: "reps", n, m, work: "a ritmo de 3–5 km (Intenso)", key: "int", pause: "2'" }
              : { t: "reps", n, m, work: "a ritmo objetivo de 10 km", key: "r10", pause: "2'" };
      const d = wd!.day;
      w.days[i] = {
        day: { ...structuredClone(tpl), day_index: d.day_index, day: d.day, strength_after: d.strength_after },
        main,
        orig: d.main_set,
        changed: true,
      };
    }

    // Semana pico: la tirada larga suma tramos a ritmo y pasa a ser de calidad.
    if (kind === "spec") {
      const li = w.days.findIndex((wd) => wd?.day.code === "TL");
      const wd = w.days[li];
      if (wd && !isDemanding(dayAt(wp, wi, li - 1)!) && !isDemanding(dayAt(wp, wi, li + 1)!)) {
        const total = mainKm(wd.main);
        const [n, m] = TRAMOS_SEQ[Math.min(tramos++, TRAMOS_SEQ.length - 1)]!;
        const work = (n * m) / 1000;
        const a = Math.max(2, r05((total - work) / 2));
        wd.main = { t: "tramos", a, n, m, work: ctx.chapter === 2 ? "a ritmo objetivo de 10 km" : "a ritmo de 10 km", key: "r10", pause: "2'", c: Math.max(1, total - work - a) };
        Object.assign(wd.day, {
          category: "mod",
          is_quality: true,
          physiological_goal: "Sostener el ritmo de competencia con fatiga acumulada",
          technical_notes: "Tramos parejos al ritmo indicado. Si el ritmo cae más de un 5 % o el RPE pasa de 8, terminar al 70 %. Practicar hidratación y alimentación de carrera.",
        });
        wd.changed = true;
      }
    }
  });
}

// ---------------------------------------------------------------- Regla 1: sin repeticiones

function bump(x: Main, dir: 1 | -1): boolean {
  switch (x.t) {
    case "reps":
    case "tramos":
    case "cr":
    case "walkrun":
      if (x.n + dir < 2) return false;
      x.n += dir;
      return true;
    case "hills":
      if (x.n + 2 * dir < 4) return false;
      x.n += 2 * dir;
      return true;
    case "cont":
    case "strides":
    case "test1":
      if (x.km + 0.5 * dir < 1) return false;
      x.km += 0.5 * dir;
      return true;
    case "two":
      if (x.km2 + 0.5 * dir < 0.5) return false;
      x.km2 += 0.5 * dir;
      return true;
    default:
      return false;
  }
}

function dedupe(wp: WPlan): void {
  for (let wi = 1; wi < wp.weeks.length; wi++) {
    const prev = new Set(wp.weeks[wi - 1]!.days.filter((d) => d?.day.is_quality && d.day.category !== "race").map((d) => renderMain(wp.ctx, d!.main)));
    const w = wp.weeks[wi]!;
    const dir: 1 | -1 = isLoad(w.week) ? 1 : -1;
    for (const wd of w.days) {
      if (!wd?.day.is_quality || wd.day.category === "race") continue;
      for (let tries = 0; prev.has(renderMain(wp.ctx, wd.main)) && tries < 4; tries++) {
        if (!bump(wd.main, dir) && !bump(wd.main, dir === 1 ? -1 : 1)) break;
        wd.changed = true;
      }
    }
  }
}

// ---------------------------------------------------------------- Recalcular sesiones y semanas

function finishDay(wp: WPlan, wd: WDay): LibrarySessionDay {
  const { ctx } = wp;
  const d = wd.day;
  const warm = convertWarm(ctx, d.warmup);
  const cool = convertWarm(ctx, d.cooldown);
  const segs = [...warm.segs, ...mainSegs(ctx, wd.main), ...cool.segs];
  const minutes: Record<string, number> = {};
  for (const s of segs) if (s.name && s.min > 0) minutes[s.name] = round((minutes[s.name] ?? 0) + s.min, 1);
  for (const k of Object.keys(minutes)) minutes[k] = round(minutes[k]!, 1);
  const main = renderMain(ctx, wd.main);
  let notes = d.technical_notes;
  if (wd.main.t === "testmax") notes = "Anotá el tiempo y el RPE, y cargá el resultado en la Calculadora: ese ritmo es tu 100 %.";
  if (wd.main.t === "test1") notes = notes.replace(/completa (\d+)' sin caminar/, `completa los ${fmtKm(wd.main.km)} sin caminar`);
  if (wd.main.t === "cr") {
    const m = wd.main.m;
    notes = notes.replace(/^(Ensayo de ritmo(?: de carrera)?): (?:\d+'|\d+") a/, `$1: ${m} m a`);
  }
  if (ctx.chapter === 1) notes = textMinutesToKm(ctx, notes);
  const pcts = parseBlock(main, "main").lines.map((l) => l.pct).filter((p): p is number => p !== null);
  const lo = Math.min(...pcts);
  const hi = Math.max(...pcts);
  return {
    ...d,
    type: sessionType(d.code, wd.main),
    warmup: warm.text,
    cooldown: cool.text,
    main_set: main,
    short_label: shortLabel(wd.main),
    intensity: lo === hi ? `${lo} %` : `${lo}–${hi} %`,
    technical_notes: plainText(notes),
    duration_min_est: round(segs.reduce((a, s) => a + s.min, 0), 1),
    distance_km_est: round(segs.reduce((a, s) => a + s.km, 0), 2),
    minutes_by_intensity: minutes,
  };
}

/** Porcentajes enteros por zona que suman 100 (resto mayor). */
function zonePct(lib: Library, days: LibrarySessionDay[]): { Z1: number; Z2: number; Z3: number } {
  const z = { Z1: 0, Z2: 0, Z3: 0 };
  for (const d of days) for (const [name, min] of Object.entries(d.minutes_by_intensity)) z[lib.zone_map[name] as keyof typeof z] += min;
  const total = z.Z1 + z.Z2 + z.Z3;
  const exact = (Object.keys(z) as (keyof typeof z)[]).map((k) => ({ k, v: (z[k] / total) * 100 }));
  const out = { Z1: 0, Z2: 0, Z3: 0 };
  for (const e of exact) out[e.k] = Math.floor(e.v);
  let rest = 100 - out.Z1 - out.Z2 - out.Z3;
  for (const e of [...exact].sort((a, b) => (b.v % 1) - (a.v % 1))) if (rest-- > 0) out[e.k]++;
  return out;
}

// ---------------------------------------------------------------- Textos

/** Minutos de carrera continua → km (Suave del capítulo) en textos descriptivos. */
export function textMinutesToKm(ctx: Ctx, text: string): string {
  const k = (min: number) => dec.format(r05((min / 60) * ctx.speed("suave")));
  const range = (a: string, b: string) => {
    const x = k(Number(a));
    const y = k(Number(b));
    return x === y ? x : `${x}–${y}`;
  };
  const hmin = (h: string, m: string) => Number(h) * 60 + Number(m);
  const trot = (min: string) => `${nearestAllowed((Number(min) / 60) * ctx.speed("suave") * 1000)} m`;
  return text
    .replace(/(\d+) h (\d{2})' continuos/g, (_, h: string, m: string) => `${k(hmin(h, m))} km continuos`)
    .replace(/(\d+)–(\d+)' (continuos|seguidos)/g, (_, a: string, b: string, w: string) => `${range(a, b)} km ${w}`)
    .replace(/\b[Dd]e (\d+)' a (\d+)' continuos/g, (all: string, a: string, b: string) => `${all[0]}e ${k(Number(a))} a ${k(Number(b))} km continuos`)
    .replace(/(\d+)' (continuos|seguidos)/g, (_, a: string, w: string) => `${k(Number(a))} km ${w}`)
    .replace(/(control(?: de aptitud)?|tirada|Ampliar a) (de )?(\d+)'/g, (_, w: string, de: string | undefined, a: string) => `${w} ${de ?? ""}${k(Number(a))} km`)
    .replace(/carrera continua de (\d+)–(\d+)'/g, (_, a: string, b: string) => `carrera continua de ${range(a, b)} km`)
    .replace(/(\d+)'\/(\d+)'/g, (_, a: string, b: string) => `${trot(a)}/${b}'`)
    .replace(/segmentos de (\d+)' de trote/g, (_, a: string) => `segmentos de ${trot(a)} de trote`)
    .replace(/cambios de 30"/g, "cambios de 100 m")
    .replace(/cambios de 1' en Moderado/g, "cambios de 200 m en Moderado")
    .replace(/\((\d+)' trote \/ (\d+)' caminata\)/g, (_, a: string, b: string) => `(${trot(a)} trote / ${b}' caminata)`)
    .replace(/menos minutos de trote/g, "menos km de trote")
    .replace(/test de 30'/g, "test de 5 km");
}

function rebuildPlanTexts(wp: WPlan, plan: LibraryPlan, days: Map<string, LibrarySessionDay>, src: LibraryPlan): void {
  const { ctx } = wp;
  const weekKm = plan.weeks.map((w) => w.totals.distance_km_est);
  // Fases: rango de km.
  for (const ph of plan.phases) {
    if (ctx.chapter === 1) ph.goal = textMinutesToKm(ctx, ph.goal);
    if (ph.km_range === undefined) continue;
    const [a, b = a] = ph.weeks.split("–").map(Number);
    const kms = weekKm.slice(a! - 1, b!);
    ph.km_range = `${dec1.format(Math.min(...kms))} – ${dec1.format(Math.max(...kms))}`;
  }
  plan.runner_profile = textMinutesToKm(ctx, plan.runner_profile);
  plan.notes = plan.notes.map((n) => textMinutesToKm(ctx, n));
  // Requisitos de entrada (volumen y tirada de la semana 1).
  const w1 = plan.weeks[0]!;
  if (plan.min_weekly_km !== null) plan.min_weekly_km = Math.round(w1.totals.distance_km_est / 1.1);
  const tl1 = w1.days.find((d) => isSession(d) && d.code === "TL");
  plan.entry_requirements = plan.entry_requirements.map((r) => {
    if (/^Volumen habitual de al menos/.test(r))
      return `Volumen habitual de al menos ${plan.min_weekly_km} km por semana en las últimas 4–6 semanas (la semana 1 tiene ${dec1.format(w1.totals.distance_km_est)} km)`;
    if (/tirada larga de la semana 1/.test(r) && tl1 && isSession(tl1)) {
      const wd = wp.weeks[0]!.days[tl1.day_index]!;
      return `Correr ${fmtKm(mainKm(wd.main))} continuos en Suave sin dolor (tirada larga de la semana 1)`;
    }
    return textMinutesToKm(ctx, r);
  });
  // Semanas: la sesión clave citada con su texto nuevo; minutos de carrera continua en km.
  plan.weeks.forEach((w, wi) => {
    const srcWeek = src.weeks[wi]!;
    srcWeek.days.forEach((d, i) => {
      const now = days.get(`${wi}-${i}`);
      if (isSession(d) && now && w.weekly_goal.includes(d.main_set)) w.weekly_goal = w.weekly_goal.replace(d.main_set, now.main_set);
    });
    w.weekly_goal = textMinutesToKm(ctx, w.weekly_goal);
    w.progression_criterion = plainText(textMinutesToKm(ctx, w.progression_criterion));
  });
}

/** Validaciones técnicas que muestra la ficha del plan (recalculadas). */
export function buildValidation(lib: Library, plan: LibraryPlan): LibraryPlan["validation"] {
  const out: LibraryPlan["validation"] = [];
  const add = (check: string, result: string, ok = true) => out.push({ check, result, ok });
  const weeks = plan.weeks;
  const km = weeks.map((w) => w.totals.distance_km_est);
  const sessions = weeks.flatMap((w) => w.days.filter(isSession));
  const pct = (a: number, b: number) => Math.round((a / b - 1) * 100);
  add("Semanas", `${weeks.length} de ${plan.duration_weeks}`, weeks.length === plan.duration_weeks);
  add("Sesiones por semana", `${plan.days_per_week} en las ${weeks.length} semanas (${sessions.length} sesiones en total)`);
  add("Descansos", `${7 - plan.days_per_week} por semana, identificados en el calendario`);
  add("Coherencia matemática", "Km y tiempo semanales = suma de las sesiones del calendario (calculado, no estimado a mano)");
  const consecutive = checkInvariants({ ...lib, plans: [plan] }).filter((e) => e.includes("exigentes seguidas"));
  add("Días exigentes seguidos", consecutive.length ? consecutive.join("; ") : "ninguno", consecutive.length === 0);

  let up1 = { v: -Infinity, a: 0, b: 0 };
  let up2 = { v: -Infinity, a: 0, b: 0 };
  for (let i = 1; i < weeks.length; i++) {
    if (!isLoad(weeks[i - 1]!) || weeks[i]!.week_type === "RACE") continue;
    const v = pct(km[i]!, km[i - 1]!);
    if (v > up1.v) up1 = { v, a: i, b: i + 1 };
    if (i >= 2 && isLoad(weeks[i - 2]!)) {
      const v2 = pct(km[i]!, km[i - 2]!);
      if (v2 > up2.v) up2 = { v: v2, a: i - 1, b: i + 1 };
    }
  }
  if (up1.v > -Infinity)
    add(
      "Progresión de volumen",
      `suba semanal máxima ${up1.v}% (S${up1.a}→S${up1.b})${up2.v > -Infinity ? `; máxima en 2 semanas ${up2.v}% (S${up2.a}→S${up2.b})` : ""}; límite de referencia del PDF: 30% en 2 semanas`,
      up2.v <= 30,
    );

  const deloads = weeks.map((w, i) => ({ w, i })).filter(({ w }) => DELOAD.has(w.week_type));
  if (deloads.length) {
    const red = deloads.map(({ i }) => Math.round((1 - km[i]! / km[i - 1]!) * 100));
    add("Descargas", `semanas ${deloads.map(({ w }) => w.week).join(", ")}; reducción frente a la semana de carga previa entre ${Math.min(...red)}% y ${Math.max(...red)}%`, red.every((r) => r > 0));
  }

  const loadWeeks = weeks.filter(isLoad);
  const z1 = loadWeeks.map((w) => w.totals.zone_pct.Z1);
  const z3 = loadWeeks.map((w) => w.totals.zone_pct.Z3);
  add("Distribución de intensidades (semanas de carga)", `Z1 entre ${Math.min(...z1)}% y ${Math.max(...z1)}%; Z3 entre ${Math.min(...z3)}% y ${Math.max(...z3)}% del tiempo en movimiento`);

  const race = raceWeekOf(plan)!;
  const q = weeks.filter((w) => w.week !== race).map((w) => w.days.filter((d) => isSession(d) && d.is_quality).length);
  add("Sesiones de calidad por semana", `máximo ${Math.max(...q)} (sin contar la semana de competencia)`);

  const rw = weeks[race - 1]!;
  const raceDay = rw.days.find((d) => isSession(d) && d.category === "race") as LibrarySessionDay;
  const training = rw.totals.distance_km_est - raceDay.distance_km_est;
  const peak = Math.max(...km);
  const less = Math.round((1 - training / peak) * 100);
  add(
    "Puesta a punto",
    `semana de competencia: ${dec1.format(training)} km de entrenamiento + la carrera, ${less}% menos que la semana pico (${dec1.format(peak)} km); banda de referencia del PDF: 41–60%`,
    less >= 41 && less <= 60,
  );

  if (plan.chapter > 1) {
    let longest: { w: number; d: LibrarySessionDay } | null = null;
    for (const w of weeks) for (const d of w.days) if (isSession(d) && d.code === "TL" && (!longest || d.distance_km_est > longest.d.distance_km_est)) longest = { w: w.week, d };
    if (longest)
      add(
        "Tirada larga más larga",
        `semana ${longest.w}: ${longest.d.main_set} — ${formatMinutes(longest.d.duration_min_est, { round: true })} con entrada en calor y vuelta a la calma, ≈${dec1.format(longest.d.distance_km_est)} km estimados`,
      );
  }
  if (plan.min_weekly_km !== null) {
    const over = pct(km[0]!, plan.min_weekly_km);
    add("Requisitos de entrada", `la semana 1 (${dec1.format(km[0]!)} km) queda un ${over}% por encima del volumen mínimo exigido (${plan.min_weekly_km} km/semana)`, over >= 0 && over <= 15);
  }
  return out;
}

// ---------------------------------------------------------------- Plan completo

function finishPlan(lib: Library, wp: WPlan, src: LibraryPlan): LibraryPlan {
  const plan = structuredClone(wp.plan);
  const days = new Map<string, LibrarySessionDay>();
  plan.weeks = wp.weeks.map((w, wi) => {
    const newDays = w.week.days.map((d, i) => {
      const wd = w.days[i];
      if (!wd) return d;
      const nd = finishDay(wp, wd);
      days.set(`${wi}-${i}`, nd);
      return nd;
    });
    const sessions = newDays.filter(isSession);
    return {
      ...w.week,
      totals: {
        ...w.week.totals,
        distance_km_est: round(sessions.reduce((a, d) => a + d.distance_km_est, 0), 2),
        duration_min_est: round(sessions.reduce((a, d) => a + d.duration_min_est, 0), 1),
        running_sessions: sessions.length,
        zone_pct: zonePct(lib, sessions),
      },
      days: newDays,
    };
  });
  rebuildPlanTexts(wp, plan, days, src);
  plan.validation = buildValidation(lib, plan);
  return plan;
}

const INTERMEDIATE_TEXTS: Record<number, { runner_profile?: string; weekly_template: string }> = {
  7: {
    runner_profile: "Corredor que ya corre 8–9,5 km continuos, con poco tiempo disponible: tres sesiones con roles claros (dos de calidad y una tirada larga).",
    weekly_template: "Mar: calidad 1 (umbral, intervalos o ritmo de 10 km) · Jue: calidad 2 (cuestas, intervalos o umbral) + fuerza · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun: fuerza sin correr. Siempre hay al menos un día libre entre dos sesiones de carrera.",
  },
  8: { weekly_template: "Mar: calidad 1 (umbral) · Mié: rodaje + fuerza · Vie: calidad 2 (cuestas, intervalos o ritmo de 10 km) · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun: fuerza sin correr." },
  9: { weekly_template: "Mar: calidad 1 · Mié: rodaje · Jue: calidad 2 · Sáb: rodaje con progresivos · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun y Vie: fuerza sin correr." },
  10: {
    runner_profile: "Corredor que corre de forma continua pero con poca experiencia en series; seis meses para construir base, desarrollo y fase específica con tres días: dos de calidad y una tirada larga.",
    weekly_template: "Mar: calidad 1 (umbral, intervalos o ritmo de 10 km) · Jue: calidad 2 (cuestas, intervalos o umbral) + fuerza · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun: fuerza sin correr. Siempre hay al menos un día libre entre dos sesiones de carrera.",
  },
  11: { weekly_template: "Mar: calidad 1 (umbral) · Mié: rodaje + fuerza · Vie: calidad 2 (cuestas, intervalos o ritmo de 10 km) · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun: fuerza sin correr." },
  12: { weekly_template: "Mar: calidad 1 · Mié: rodaje · Jue: calidad 2 · Sáb: rodaje con progresivos · Dom: tirada larga (con tramos a ritmo en el bloque específico) · Lun y Vie: fuerza sin correr." },
  19: {
    runner_profile: "Corredor que ya completó un 5 km, corre 8–8,5 km continuos y quiere mejorar su tiempo con solo tres días: dos sesiones de calidad y una tirada larga.",
    weekly_template: "Mar: calidad 1 (umbral en el bloque piramidal; HIIT en el polarizado) · Jue: calidad 2 (cuestas o intervalos) + fuerza · Dom: tirada larga (con tramos a ritmo en el bloque polarizado) · Lun: fuerza sin correr.",
  },
  20: { weekly_template: "Lun: fuerza · Mar: calidad 1 (umbral → HIIT) · Mié: rodaje + fuerza · Vie: calidad 2 (cuestas → umbral de mantenimiento) · Dom: tirada larga (con tramos a ritmo en el bloque polarizado)." },
  21: { weekly_template: "Mar: calidad 1 (umbral → HIIT) · Mié: rodaje · Jue: calidad 2 (cuestas → umbral de mantenimiento) · Sáb: rodaje con progresivos · Dom: tirada larga (con tramos a ritmo en el bloque polarizado) · Lun y Vie: fuerza sin correr." },
};

const INTERMEDIATE_GOAL = "Volumen e intensidad del nivel intermedio: dos sesiones de calidad por semana de carga y tres en las semanas pico";

function rebuildPlan(lib: Library, src: LibraryPlan, f: number): LibraryPlan {
  const wp = load(lib, structuredClone(src));
  if (src.level === "Intermedio") boostIntermediate(lib, wp, f);
  dedupe(wp);
  let plan = finishPlan(lib, wp, src);
  // Puesta a punto dentro de la banda (41–60 % menos que la semana pico): se ajustan los rodajes
  // de la semana de competencia.
  for (let i = 0; i < 12; i++) {
    const taper = plan.validation.find((v) => v.check === "Puesta a punto");
    const less = Number(/(\d+)% menos/.exec(taper?.result ?? "")?.[1]);
    if (!taper || taper.ok) break;
    const f = less > 60 ? 1.1 : 0.9;
    const race = wp.weeks[raceWeekOf(src)! - 1]!;
    for (const wd of race.days)
      if (wd && !wd.day.is_quality && (wd.main.t === "cont" || wd.main.t === "strides")) {
        wd.main.km = r05(wd.main.km * f);
        wd.changed = true;
      }
    plan = finishPlan(lib, wp, src);
  }
  if (src.level === "Intermedio") {
    const t = INTERMEDIATE_TEXTS[src.number];
    if (t) Object.assign(plan, t);
    if (!plan.secondary_goals.includes(INTERMEDIATE_GOAL)) plan.secondary_goals = [INTERMEDIATE_GOAL, ...plan.secondary_goals];
  }
  return plan;
}

/** Intermedio: factor de los rodajes para que el promedio semanal quede ~22,5 % arriba del original. */
function rebuildIntermediate(lib: Library, src: LibraryPlan): LibraryPlan {
  const target = averageWeeklyKm(src) * 1.225;
  let best: { plan: LibraryPlan; err: number } | null = null;
  for (let f = 1.0; f <= 1.5; f += 0.01) {
    const plan = rebuildPlan(lib, src, f);
    const err = Math.abs(averageWeeklyKm(plan) - target);
    if (!best || err < best.err) best = { plan, err };
  }
  return best!.plan;
}

// ---------------------------------------------------------------- Biblioteca

export function rebuildLibrary(source: Library): Library {
  if (source.content_version !== SOURCE_VERSION) throw new Error(`La entrada debe ser la versión ${SOURCE_VERSION} (es ${source.content_version}).`);
  const lib = structuredClone(source);
  lib.content_version = NEW_VERSION;
  lib.model_runner_assumptions.note =
    "Km y tiempos estimados con un corredor modelo por capítulo. Las sesiones se prescriben en km; los porcentajes son sobre la velocidad del test de 5 km (100 %), igual que en la Calculadora.";
  lib.intensity_scale = lib.intensity_scale.map((i) => (i.name === "Velocidad" ? { ...i, use: "Progresivos de 100 m (técnica y economía)" } : i));
  lib.session_catalog = lib.session_catalog.map((s) => {
    if (s.code === "CC") return { ...s, description: "Tramos de trote Suave (en metros) alternados con caminata (en minutos)" };
    if (s.code === "R+P") return { ...s, description: "Rodaje Suave + 6 × 100 m progresivos con 1'40\" de trote" };
    if (s.code === "CUE") return { ...s, description: "Subidas de 100–300 m al 4–6% con vuelta caminando o trotando" };
    if (s.code === "CTRL") return { ...s, description: "Test de 5 km o carrera de control" };
    if (s.code === "INT") return { ...s, description: "Repeticiones de 200–1500 m a ritmo de 3–10 km con pausa de trote" };
    return s;
  });
  lib.glossary = lib.glossary.map((g) => ({ ...g, definition: g.definition.replace('Aceleraciones cortas (20")', "Aceleraciones cortas (100 m)") }));
  lib.individual_adaptation = lib.individual_adaptation.map((a) => {
    if (a.situation === "Corre más lento que el corredor modelo")
      return { ...a, adaptation: "Mantener los km y los porcentajes: cada sesión lleva más tiempo que el estimado. Si el tiempo real supera en más de 15% el estimado, acortar la distancia para respetar el tiempo estimado." };
    if (a.situation === "Corre más rápido que el corredor modelo")
      return { ...a, adaptation: "Mantener los km y los porcentajes: cada sesión lleva menos tiempo que el estimado. No agregar km ni sesiones." };
    return a;
  });
  // Reglas que se muestran después de entrenar (check-in): sin nombres de esfuerzo.
  lib.load_monitoring = lib.load_monitoring.map((r) => ({
    ...r,
    signal: r.signal === LEGACY_EASY_SIGNAL ? EASY_SIGNAL : r.signal,
    reduce_or_repeat: r.reduce_or_repeat
      .replace("cambiar la calidad por un rodaje Suave", "cambiar la sesión exigente por una carrera continua al 70 %")
      .replace("solo Suave y más corto", "solo carreras al 70 % y más cortas"),
  }));
  lib.practical_rules = lib.practical_rules.map((r) => r.replace("si se agrega un día, ese día es Suave.", "si se agrega un día, ese día va al 70 %."));
  lib.plans = source.plans.map((p) => (p.level === "Intermedio" ? rebuildIntermediate(source, p) : rebuildPlan(source, p, 1)));
  return librarySchema.parse(lib);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output = LIBRARY_JSON] = process.argv.slice(2);
  if (!input) throw new Error("Uso: rebuild-plans.ts <json 2026.10.1> [salida]");
  const lib = rebuildLibrary(librarySchema.parse(JSON.parse(readFileSync(input, "utf8"))));
  const problems = [...checkInvariants(lib), ...checkQualityRules(lib)];
  if (problems.length) {
    console.error(problems.slice(0, 60).join("\n"));
    console.error(`${problems.length} problemas`);
  }
  writeFileSync(output, JSON.stringify(lib, null, 1) + "\n");
  console.log(`Escrito ${output} (${lib.content_version})`);
  if (problems.length) process.exitCode = 1;
}
