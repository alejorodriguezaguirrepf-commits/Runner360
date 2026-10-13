import { daysBetween } from "./dates";

/**
 * Ritmos de referencia estimados con la fórmula de Riegel (1981): T2 = T1 × (D2 / D1)^1,06.
 * Es una ESTIMACIÓN: el RPE y la prueba del habla siguen siendo la referencia principal.
 * En maratón tiende a ser optimista: se muestra como límite rápido, no como objetivo.
 */
export const RIEGEL_EXPONENT = 1.06;
export const MARK_MAX_AGE_WEEKS = 8;
export const REFERENCE_DISTANCES_KM = [5, 10, 21.0975, 42.195] as const;

export function riegelTime(timeS: number, fromKm: number, toKm: number, exponent = RIEGEL_EXPONENT): number {
  if (!(timeS > 0) || !(fromKm > 0) || !(toKm > 0)) throw new Error("Valores inválidos para Riegel");
  return timeS * Math.pow(toKm / fromKm, exponent);
}

export type RecentMark = { distanceKm: number; timeS: number; date: string };

/** La marca sirve si es de las últimas 8 semanas (y no es futura). */
export function isMarkRecent(mark: RecentMark, today: string): boolean {
  const days = daysBetween(mark.date, today);
  return days >= 0 && days <= MARK_MAX_AGE_WEEKS * 7;
}

export type ReferencePace = { distanceKm: number; timeS: number; paceSPerKm: number; marathonFastLimit: boolean };

/** Tiempos y ritmos estimados para las distancias de referencia, o null si la marca no es reciente. */
export function referencePaces(mark: RecentMark, today: string): ReferencePace[] | null {
  if (!isMarkRecent(mark, today)) return null;
  return REFERENCE_DISTANCES_KM.map((d) => {
    const t = riegelTime(mark.timeS, mark.distanceKm, d);
    return { distanceKm: d, timeS: t, paceSPerKm: t / d, marathonFastLimit: d > 40 };
  });
}
