/**
 * Intensidad de cada tramo: porcentaje de la velocidad del test (el mismo de la Calculadora) y su
 * RPE. La equivalencia vive en un solo lugar: src/rpe-scale.json.
 *
 *   50–65 % → RPE 2–3 · 66–75 % → 4–5 · 76–85 % → 6–7 · 86–95 % → 8 · 96–100 % → 9 · más de 100 % → 10
 */
import scale from "./rpe-scale.json";

export type EffortBand = { maxPct: number; rpe: number; level: number };
export const RPE_BANDS: readonly EffortBand[] = scale.bands;

/** Banda del porcentaje (redondeado). */
function bandOf(pct: number): EffortBand {
  const p = Math.round(pct);
  return RPE_BANDS.find((b) => p <= b.maxPct) ?? RPE_BANDS[RPE_BANDS.length - 1]!;
}

/** RPE (1–10) de un porcentaje. */
export function rpeFor(pct: number): number {
  return bandOf(pct).rpe;
}

/** Nivel de color (1 = más suave … 6 = más intenso) de un porcentaje. */
export function effortLevel(pct: number): number {
  return bandOf(pct).level;
}

/** "75 % · RPE 5". */
export function effortLabel(pct: number): string {
  return `${Math.round(pct)} % · RPE ${rpeFor(pct)}`;
}

/** Rangos para la tabla de ayuda: "50–57 %" → RPE 2 … "más de 100 %" → RPE 10. */
export function rpeTable(minPct = 50): { range: string; rpe: number }[] {
  let from = minPct;
  return RPE_BANDS.map((b) => {
    const range = b.maxPct >= 1000 ? `más de ${from - 1} %` : `${from}–${b.maxPct} %`;
    from = b.maxPct + 1;
    return { range, rpe: b.rpe };
  });
}

/** Ritmo (segundos por km) para un porcentaje de la velocidad del test. */
export function paceForPct(test: { meters: number; seconds: number }, pct: number): number {
  if (!(test.meters > 0) || !(test.seconds > 0) || !(pct > 0)) throw new Error("Datos inválidos");
  return ((test.seconds / test.meters) * 1000) / (pct / 100);
}
