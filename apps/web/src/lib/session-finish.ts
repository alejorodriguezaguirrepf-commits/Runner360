/**
 * Datos de una sesión terminada: ritmo, carga (RPE × minutos) y escala de RPE. Funciones puras (también
 * en el navegador): se prueban en test/wellness.test.ts.
 */

export type Split = { meters: number; seconds: number };

/** Ritmo en segundos por km. */
export function paceSPerKm(meters: number, seconds: number): number | null {
  return meters > 0 && seconds > 0 ? (seconds * 1000) / meters : null;
}

/** Carga de la sesión (sRPE, Foster): RPE × minutos. */
export function sessionLoad(rpe: number | null, seconds: number | null): number | null {
  if (!rpe || !seconds) return null;
  return Math.round(rpe * (seconds / 60));
}

/** Escala de esfuerzo percibido (RPE 1–10, Borg CR-10 adaptada). */
export const RPE_LABELS: Record<number, string> = {
  1: "Muy, muy suave",
  2: "Muy suave",
  3: "Suave",
  4: "Moderado",
  5: "Algo exigente",
  6: "Exigente",
  7: "Muy exigente",
  8: "Muy, muy exigente",
  9: "Casi máximo",
  10: "Máximo",
};
