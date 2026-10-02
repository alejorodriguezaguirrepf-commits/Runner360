/**
 * Cálculos de ritmo, velocidad, tiempos objetivo y parciales.
 * Entradas en metros y segundos. Todas las funciones validan entradas y nunca dividen por cero.
 */

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} debe ser un número positivo`);
  }
}

/** Ritmo medio en segundos por kilómetro. `null` si la distancia o la duración no son válidas. */
export function paceSecondsPerKm(distanceM: number, durationS: number): number | null {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (durationS * 1000) / distanceM;
}

/** Velocidad media en km/h. `null` si los datos no son válidos. */
export function speedKmh(distanceM: number, durationS: number): number | null {
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (distanceM / 1000) / (durationS / 3600);
}

/** Tiempo total (s, redondeado) para recorrer `distanceM` a un ritmo de `paceSPerKm`. */
export function timeFromPace(distanceM: number, paceSPerKm: number): number {
  assertFinitePositive(distanceM, "La distancia");
  assertFinitePositive(paceSPerKm, "El ritmo");
  return Math.round((distanceM / 1000) * paceSPerKm);
}

/** Ritmo necesario (s/km) para completar `distanceM` en `timeS`. */
export function paceForTarget(distanceM: number, timeS: number): number {
  assertFinitePositive(distanceM, "La distancia");
  assertFinitePositive(timeS, "El tiempo");
  return (timeS * 1000) / distanceM;
}

export interface Split {
  index: number;
  /** Distancia del parcial en metros. */
  distanceM: number;
  /** Distancia acumulada al final del parcial. */
  cumulativeDistanceM: number;
  /** Tiempo del parcial (s) con ritmo parejo. */
  splitTimeS: number;
  /** Tiempo acumulado al final del parcial (s). */
  cumulativeTimeS: number;
}

/**
 * Divide una carrera en parciales de `splitM` metros a ritmo parejo.
 * El último parcial puede ser más corto. Los tiempos acumulados se redondean al segundo y
 * el último coincide exactamente con el tiempo objetivo.
 */
export function buildEvenSplits(distanceM: number, targetTimeS: number, splitM = 1000): Split[] {
  assertFinitePositive(distanceM, "La distancia");
  assertFinitePositive(targetTimeS, "El tiempo objetivo");
  assertFinitePositive(splitM, "El largo del parcial");
  const count = Math.ceil(distanceM / splitM - 1e-9);
  if (count > 1000) throw new RangeError("Demasiados parciales");
  const splits: Split[] = [];
  let prevTime = 0;
  for (let i = 1; i <= count; i++) {
    const cumulativeDistanceM = Math.min(i * splitM, distanceM);
    const cumulativeTimeS =
      i === count ? Math.round(targetTimeS) : Math.round((targetTimeS * cumulativeDistanceM) / distanceM);
    splits.push({
      index: i,
      distanceM: cumulativeDistanceM - (i - 1) * splitM,
      cumulativeDistanceM,
      splitTimeS: cumulativeTimeS - prevTime,
      cumulativeTimeS,
    });
    prevTime = cumulativeTimeS;
  }
  return splits;
}

/**
 * Parsea "mm:ss" o "h:mm:ss" a segundos. Devuelve `null` si el formato es inválido.
 * Minutos y segundos deben estar en 0–59 cuando hay una unidad superior.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,3}(:\d{1,2}){1,2}$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.length === 2) {
    const [m, sec] = parts as [number, number];
    if (sec > 59) return null;
    return m * 60 + sec;
  }
  const [h, m, sec] = parts as [number, number, number];
  if (m > 59 || sec > 59) return null;
  return h * 3600 + m * 60 + sec;
}

/** Formatea segundos como "h:mm:ss" o "m:ss". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const t = Math.round(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Formatea un ritmo (s/km) como "m:ss". Redondea al segundo evitando "4:60". */
export function formatPace(paceSPerKm: number | null): string {
  if (paceSPerKm === null || !Number.isFinite(paceSPerKm) || paceSPerKm <= 0) return "—";
  return formatDuration(Math.round(paceSPerKm));
}

/**
 * Convierte kilómetros ingresados por el usuario (acepta coma o punto decimal) a metros enteros.
 * Devuelve `null` si el valor no es válido.
 */
export function kmInputToMeters(input: string | number): number | null {
  const raw = typeof input === "number" ? String(input) : input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(raw)) return null;
  const [intPart, decPart = ""] = raw.split(".") as [string, string?];
  const meters = Number(intPart) * 1000 + Number((decPart ?? "").padEnd(3, "0"));
  return Number.isSafeInteger(meters) ? meters : null;
}
