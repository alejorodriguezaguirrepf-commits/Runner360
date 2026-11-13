/**
 * Textos cortos con los datos de entrenamiento que Runnie recibe de la persona: la sesión de hoy (con
 * los tiempos según su test), la fuerza, el wellness y las últimas sesiones. Funciones puras (se
 * prueban en test/runnie.test.ts); las usa lib/runnie/context.ts.
 */
import { formatClock, PATTERN_LABELS, paceForPct, sessionBlocks, sessionTimes, type StrengthDose } from "@runner360/plan-library";
import { LOAD_STATUS_LABEL, type LoadStatus } from "@/lib/monitoring";
import { paceSPerKm, sessionLoad } from "@/lib/session-finish";
import { WELLNESS_ITEMS, WELLNESS_LEVEL_LABEL, wellnessFlags, wellnessLevel, type WellnessRow } from "@/lib/wellness";

type Test = { meters: number; seconds: number };
type Day = { warmup: string | null; main_set: string | null; cooldown: string | null };

const BLOCK_LABEL = { warmup: "Entrada en calor", main: "Parte principal", cooldown: "Vuelta a la calma" } as const;
const km = (m: number) => (m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const dist = (m: number) => (m >= 1000 ? `${km(m)} km` : `${m} m`);

/** "8 km en 25:00" del test. */
export function testLine(test: Test, date: string): string {
  return `${dist(test.meters)} en ${formatClock(test.seconds)} (cargado el ${date})`;
}

/**
 * La sesión de un día, tramo por tramo, con el porcentaje, la pausa y, si hay test, el ritmo por km
 * y el tiempo de cada repetición (lo mismo que ve en la pantalla).
 */
export function sessionLines(day: Day, test: Test | null): string[] {
  const times = sessionTimes(day, test);
  const firstRow = new Map<number, (typeof times.rows)[number]>();
  for (const r of times.rows) if (!firstRow.has(r.line)) firstRow.set(r.line, r);
  const out: string[] = [];
  let line = -1;
  for (const block of sessionBlocks(day).filter((b) => b.lines.length > 0)) {
    const parts = block.lines.map((l) => {
      line++;
      let text = l.what + (l.pct ? ` al ${l.pct} %` : "");
      const row = firstRow.get(line);
      if (test && l.pct) {
        const extra = [`ritmo ${formatClock(Math.round(paceForPct(test, l.pct)))}/km`];
        if (row?.editable && row.seconds) extra.push(`${formatClock(row.seconds)} ${row.reps > 1 ? "cada uno" : "en total"}`);
        if (row && !row.editable && row.estMeters) extra.push(`unos ${dist(row.estMeters)}${row.reps > 1 ? " cada uno" : ""}`);
        text += ` (${extra.join(", ")})`;
      }
      if (l.recovery) text += `, ${l.recovery.charAt(0).toLowerCase()}${l.recovery.slice(1)}`;
      if (l.note) text += `. ${l.note}`;
      return text;
    });
    out.push(`${BLOCK_LABEL[block.kind]}${block.total ? ` (${block.total})` : ""}: ${parts.join(" + ")}`);
  }
  return out;
}

/** "Sesión 1 de la rutina B · 4 × 5 · 3 en reserva: Sentadilla goblet; Peso muerto rumano; …". */
export function strengthLine(s: { routine: string; session: number; dose: StrengthDose | null; exercises: { exercise: string; sets_reps: string; pattern: string | null }[] }): string {
  const dose = s.dose ? ` · ${s.dose.sets} series × ${s.dose.reps} repeticiones, dejando ${s.dose.rir} en reserva` : "";
  const list = s.exercises
    .map((e) => (e.pattern && e.pattern in PATTERN_LABELS ? `${e.exercise} (${PATTERN_LABELS[e.pattern as keyof typeof PATTERN_LABELS].toLowerCase()})` : `${e.exercise} (${e.sets_reps})`))
    .join("; ");
  return `Sesión ${s.session} de la rutina ${s.routine}${dose}${s.dose?.note ? `. ${s.dose.note}` : ""}: ${list}`;
}

/** "18/25 (Bien); en 1 o 2 (lo peor): sueño". */
export function wellnessLine(w: WellnessRow): string {
  const flags = wellnessFlags(w).map((k) => WELLNESS_ITEMS[k].label.toLowerCase());
  return `${w.score}/25 (${WELLNESS_LEVEL_LABEL[wellnessLevel(w.score)]})${flags.length ? `; en 1 o 2 (lo peor): ${flags.join(", ")}` : ""}`;
}

/** "2026-11-10: 8 km en 45:00 (5:37/km), RPE 6, carga 270, 5 parciales". */
export function recentSessionLine(s: { workout_date: string; distance_m: number | null; duration_s: number | null; rpe: number | null; splits: unknown[] }): string {
  const parts: string[] = [];
  if (s.distance_m) parts.push(`${km(s.distance_m)} km`);
  if (s.duration_s) parts.push(`en ${formatClock(s.duration_s)}`);
  const pace = s.distance_m && s.duration_s ? paceSPerKm(s.distance_m, s.duration_s) : null;
  if (pace) parts.push(`(${formatClock(Math.round(pace))}/km)`);
  const extra: string[] = [];
  if (s.rpe) extra.push(`RPE ${s.rpe}`);
  const load = sessionLoad(s.rpe, s.duration_s);
  if (load) extra.push(`carga ${load}`);
  if (s.splits.length) extra.push(`${s.splits.length} parciales`);
  return `${s.workout_date}: ${parts.join(" ") || "sin distancia ni tiempo"}${extra.length ? `, ${extra.join(", ")}` : ""}`;
}

/** "Carga de los últimos 7 días: 820 (estable frente a su promedio de 790 por semana)". */
export function loadLine(acute: number, chronic: number, status: LoadStatus | null): string {
  return `Carga de los últimos 7 días (RPE × minutos): ${acute}${status ? ` (${LOAD_STATUS_LABEL[status].toLowerCase()} frente a su promedio de ${chronic} por semana)` : ""}`;
}
