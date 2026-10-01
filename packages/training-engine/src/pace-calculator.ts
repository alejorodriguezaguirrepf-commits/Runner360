/**
 * Calculadora de ritmo. Todos los resultados son ESTIMACIONES de ritmo parejo,
 * nunca predicciones ni garantías de rendimiento.
 */

/** Ritmo objetivo (s/km) para completar una distancia en un tiempo. */
export function targetPace(distanceM: number, targetTimeS: number): number | null {
  if (!(distanceM > 0) || !(targetTimeS > 0)) return null;
  return (targetTimeS * 1000) / distanceM;
}

/** Tiempo final estimado (s) a un ritmo parejo. */
export function finishTimeAtPace(distanceM: number, paceSPerKm: number): number | null {
  if (!(distanceM > 0) || !(paceSPerKm > 0)) return null;
  return Math.round((distanceM * paceSPerKm) / 1000);
}

export interface PlannedSplit {
  index: number;
  /** Distancia acumulada al final del parcial (m). */
  cumulativeDistanceM: number;
  /** Distancia del parcial (m). El último puede ser menor. */
  splitDistanceM: number;
  splitTimeS: number;
  cumulativeTimeS: number;
}

/**
 * Divide una carrera en parciales de `splitDistanceM` a ritmo parejo.
 * Los tiempos acumulados se redondean al segundo y el último parcial absorbe el redondeo,
 * de modo que la suma coincide exactamente con el tiempo objetivo.
 */
export function evenSplits(distanceM: number, targetTimeS: number, splitDistanceM: number): PlannedSplit[] {
  if (!(distanceM > 0) || !(targetTimeS > 0) || !(splitDistanceM > 0)) return [];
  if (distanceM / splitDistanceM > 1000) return [];
  const out: PlannedSplit[] = [];
  let covered = 0;
  let prevCum = 0;
  let i = 1;
  while (covered < distanceM) {
    const d = Math.min(splitDistanceM, distanceM - covered);
    covered += d;
    const cum = covered === distanceM ? targetTimeS : Math.round((targetTimeS * covered) / distanceM);
    out.push({
      index: i++,
      cumulativeDistanceM: covered,
      splitDistanceM: d,
      splitTimeS: cum - prevCum,
      cumulativeTimeS: cum,
    });
    prevCum = cum;
  }
  return out;
}
