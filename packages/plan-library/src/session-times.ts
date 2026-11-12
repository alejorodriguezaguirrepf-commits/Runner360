import { paceForPct } from "./effort";
import { sessionBlocks, type BlockKind } from "./session-blocks";

/**
 * Tiempos de una sesión, tramo por tramo: lo prescripto (con el test de la Calculadora, según el
 * porcentaje de cada tramo) y lo que hizo la persona. Con esto se arma el registro automático:
 * distancia, duración y parciales. Funciones puras: se prueban en test/session-times.test.ts.
 */

export type TimeRow = {
  block: BlockKind;
  /** "1000 m", "6,5 km", "15 min". */
  label: string;
  /** Repetición dentro del tramo (1 de 5) o null si es un tramo único. */
  rep: number | null;
  reps: number;
  pct: number | null;
  /** Distancia del tramo (null en los tramos por tiempo). */
  meters: number | null;
  /** Tiempo prescripto en segundos: por tiempo, siempre; por distancia, solo con test. */
  seconds: number | null;
  /** Distancia estimada de un tramo por tiempo (con test y porcentaje). */
  estMeters: number | null;
  /** Se carga el tiempo real (los tramos por distancia). */
  editable: boolean;
  /** Va dentro del tramo anterior (p. ej. «Al final: 6 × 100 m»): no suma distancia ni tiempo. */
  embedded: boolean;
};

export type SessionTimes = { rows: TimeRow[]; pausesS: number };
type Test = { meters: number; seconds: number };

const num = (s: string) => Number(s.replace(",", "."));
const EMBEDDED = /^(al final|desde el km \d+)\s*:/i;
const AMOUNT = /^(?:[^:]+:\s*)?(?:(\d+) × )?(\d+(?:,\d+)?) (m|km|min)\b/i;

/** Segundos de una pausa: «Pausa 2 min 30 s trotando», «Pausa 40 s». */
export function pauseSeconds(recovery: string | null): number {
  if (!recovery) return 0;
  const m = /^pausa (?:(\d+) min)?\s*(?:(\d+) s)?/i.exec(recovery.trim());
  if (!m) return 0;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

export function sessionTimes(day: { warmup: string | null; main_set: string | null; cooldown: string | null }, test: Test | null): SessionTimes {
  const rows: TimeRow[] = [];
  let pausesS = 0;
  for (const block of sessionBlocks(day)) {
    for (const line of block.lines) {
      const a = AMOUNT.exec(line.what);
      if (!a) continue;
      const reps = Math.max(1, Number(a[1] ?? 1));
      const value = num(a[2]!);
      const unit = a[3]!.toLowerCase();
      const embedded = EMBEDDED.test(line.what);
      const pace = test && line.pct ? paceForPct(test, line.pct) : null; // s por km
      // Lo que se ve en la fila: el tramo sin la cantidad de repeticiones ("Al final: 100 m").
      const label = line.what.replace(/(\d+) × /, "");
      if (unit === "min") {
        const seconds = Math.round(value * 60);
        for (let r = 1; r <= reps; r++)
          rows.push({
            block: block.kind,
            label,
            rep: reps > 1 ? r : null,
            reps,
            pct: line.pct,
            meters: null,
            seconds,
            estMeters: pace ? Math.round((seconds / pace) * 1000) : null,
            editable: false,
            embedded,
          });
      } else {
        const meters = Math.round(unit === "km" ? value * 1000 : value);
        for (let r = 1; r <= reps; r++)
          rows.push({
            block: block.kind,
            label,
            rep: reps > 1 ? r : null,
            reps,
            pct: line.pct,
            meters,
            seconds: pace ? Math.round((pace * meters) / 1000) : null,
            estMeters: null,
            editable: true,
            embedded,
          });
      }
      if (!embedded) pausesS += pauseSeconds(line.recovery) * (reps - 1);
    }
  }
  return { rows, pausesS };
}

/**
 * Totales con lo real (o lo prescripto donde no se cargó nada). null si falta algún tiempo que no se
 * puede estimar (sin test y sin dato cargado): ahí se usa la estimación del plan.
 */
export function sessionTotals(t: SessionTimes, actual: (number | null)[]): { meters: number; seconds: number } | null {
  let meters = 0;
  let seconds = t.pausesS;
  for (const [i, r] of t.rows.entries()) {
    if (r.embedded) continue;
    const s = r.editable ? (actual[i] ?? r.seconds) : r.seconds;
    if (s === null) return null;
    seconds += s;
    meters += r.meters ?? r.estMeters ?? 0;
  }
  return { meters, seconds };
}

/** Ritmo razonable por km (de 2:00 a 30:00): sirve para rechazar un tiempo mal escrito. */
export function plausibleSplit(meters: number, seconds: number): boolean {
  const pace = (seconds * 1000) / meters;
  return pace >= 120 && pace <= 1800;
}
