/**
 * "Finalizar sesión": parciales por km y RPE de la sesión. Funciones puras (también en el navegador):
 * se prueban en test/session-finish.test.ts.
 */

/** Máximo de parciales (100 km). */
export const MAX_SPLITS = 100;
/** Un último tramo de menos de 50 m no se carga aparte. */
const MIN_LAST_M = 50;

export type SplitSlot = { index: number; meters: number };
export type Split = { meters: number; seconds: number };

/** Tramos para la distancia total: un parcial por km completo y uno final con lo que sobra. */
export function splitSlots(totalMeters: number): SplitSlot[] {
  if (!(totalMeters > 0)) return [];
  const m = Math.min(Math.round(totalMeters), MAX_SPLITS * 1000);
  const full = Math.floor(m / 1000);
  const rest = m - full * 1000;
  const slots: SplitSlot[] = Array.from({ length: full }, (_, i) => ({ index: i + 1, meters: 1000 }));
  if (rest >= MIN_LAST_M) slots.push({ index: full + 1, meters: rest });
  else if (rest > 0 && slots.length) slots[slots.length - 1] = { index: full, meters: 1000 + rest };
  return slots;
}

/** Km escritos como "8", "8,5" o "8.5" → metros (null si no es válido). */
export function parseKmInput(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(t)) return null;
  const m = Math.round(Number(t) * 1000);
  return m > 0 && m <= MAX_SPLITS * 1000 ? m : null;
}

/** Ritmo en segundos por km. */
export function paceSPerKm(meters: number, seconds: number): number | null {
  return meters > 0 && seconds > 0 ? (seconds * 1000) / meters : null;
}

/** Carga de la sesión (sRPE, Foster): RPE × minutos. */
export function sessionLoad(rpe: number | null, seconds: number | null): number | null {
  if (!rpe || !seconds) return null;
  return Math.round(rpe * (seconds / 60));
}

export type SessionSummary = { meters: number; seconds: number; paceS: number | null; load: number | null; fastest: number | null; slowest: number | null };

/** Totales de los parciales cargados; marca el km más rápido y el más lento (solo km completos). */
export function summarize(splits: Split[], rpe: number | null): SessionSummary {
  const meters = splits.reduce((a, s) => a + s.meters, 0);
  const seconds = splits.reduce((a, s) => a + s.seconds, 0);
  const paces = splits.map((s, i) => ({ i, pace: paceSPerKm(s.meters, s.seconds) ?? Infinity, full: s.meters >= 1000 }));
  const full = paces.filter((p) => p.full);
  const fastest = full.length > 1 ? full.reduce((a, b) => (b.pace < a.pace ? b : a)).i : null;
  const slowest = full.length > 1 ? full.reduce((a, b) => (b.pace > a.pace ? b : a)).i : null;
  return { meters, seconds, paceS: paceSPerKm(meters, seconds), load: sessionLoad(rpe, seconds), fastest, slowest: slowest === fastest ? null : slowest };
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
