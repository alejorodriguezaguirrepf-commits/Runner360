/**
 * Seguimiento de la carga y la recuperación (wellness + RPE de las sesiones). Funciones puras: se
 * prueban en test/monitoring.test.ts. Fechas como "YYYY-MM-DD".
 */
import { sessionLoad } from "@/lib/session-finish";

const DAY = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysIso = (d: string, n: number) => toIso(toMs(d) + n * DAY);
/** Lunes de la semana de una fecha. */
export function mondayIso(d: string): string {
  const wd = (new Date(toMs(d)).getUTCDay() + 6) % 7;
  return addDaysIso(d, -wd);
}

export type LoadSession = { workout_date: string; rpe: number | null; duration_s: number | null };

/** Carga (RPE × min) por semana, de la semana más vieja a la actual. */
export function weeklyLoads(sessions: LoadSession[], today: string, weeks: number): { key: string; load: number; count: number }[] {
  const current = mondayIso(today);
  const out = Array.from({ length: weeks }, (_, i) => ({ key: addDaysIso(current, -(weeks - 1 - i) * 7), load: 0, count: 0 }));
  const index = new Map(out.map((w, i) => [w.key, i]));
  for (const s of sessions) {
    const i = index.get(mondayIso(s.workout_date));
    if (i === undefined) continue;
    out[i]!.load += sessionLoad(s.rpe, s.duration_s) ?? 0;
    out[i]!.count += 1;
  }
  return out;
}

/**
 * Carga aguda (últimos 7 días) frente a la crónica (promedio semanal de los últimos 28). Un cociente
 * entre 0,8 y 1,3 suele considerarse estable; más de 1,5, un salto brusco.
 */
export function acuteChronic(sessions: LoadSession[], today: string): { acute: number; chronic: number; ratio: number | null } {
  const sum = (from: string) =>
    sessions.filter((s) => s.workout_date > from && s.workout_date <= today).reduce((a, s) => a + (sessionLoad(s.rpe, s.duration_s) ?? 0), 0);
  const acute = sum(addDaysIso(today, -7));
  const chronic = Math.round(sum(addDaysIso(today, -28)) / 4);
  return { acute, chronic, ratio: chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null };
}

export type LoadStatus = "low" | "stable" | "high" | "spike";
export function loadStatus(ratio: number | null): LoadStatus | null {
  if (ratio === null) return null;
  if (ratio < 0.8) return "low";
  if (ratio <= 1.3) return "stable";
  if (ratio <= 1.5) return "high";
  return "spike";
}
export const LOAD_STATUS_LABEL: Record<LoadStatus, string> = { low: "Baja", stable: "Estable", high: "En aumento", spike: "Salto brusco" };
