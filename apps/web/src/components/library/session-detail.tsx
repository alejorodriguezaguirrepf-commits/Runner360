import { effortLabel, effortLevel, formatPace, mainSetInKm, paceForPct, sessionBlocks, rpeTable, type SessionBlock, type Speeds } from "@runner360/plan-library";
import { cx } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { DayRow } from "@/lib/data/library";

const m = t.library.workout;

/** Test de la Calculadora (distancia y tiempo): con él se muestra el ritmo de cada porcentaje. */
export type PaceTest = { meters: number; seconds: number };

/** Colores por nivel de intensidad (1 = más suave … 6 = más intenso); legibles en ambos temas. */
const LEVEL_CLASSES: Record<number, string> = {
  0: "border-cat-rest bg-cat-rest-bg",
  1: "border-cat-rec bg-cat-rec-bg",
  2: "border-cat-easy bg-cat-easy-bg",
  3: "border-cat-mod bg-cat-mod-bg",
  4: "border-cat-thr bg-cat-thr-bg",
  5: "border-cat-hard bg-cat-hard-bg",
  6: "border-cat-race bg-cat-race-bg",
};
const LEVEL_TEXT: Record<number, string> = {
  0: "text-cat-rest",
  1: "text-cat-rec",
  2: "text-cat-easy",
  3: "text-cat-mod",
  4: "text-cat-thr",
  5: "text-cat-hard",
  6: "text-cat-race",
};

const BLOCK_NAMES = { warmup: m.warmup, main: m.main, cooldown: m.cooldown } as const;

/** Explicación del RPE a un toque: no ocupa lugar hasta que se abre. */
export function RpeHelp() {
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-primary-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full border-2 border-current text-xs font-extrabold">?</span>
        {m.rpeHelp}
      </summary>
      <div className="mt-1 rounded-xl border border-line bg-surface-2 p-3">
        <p>{m.rpeText}</p>
        <table className="mt-2 w-full text-left text-sm">
          <caption className="sr-only">{m.rpeTable}</caption>
          <tbody className="divide-y divide-line">
            {rpeTable().map((r) => (
              <tr key={r.range}>
                <th scope="row" className="py-1 pr-3 font-medium tabular">{r.range}</th>
                <td className="py-1 font-semibold tabular">RPE {r.rpe}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Block({ block, n, test, speeds }: { block: SessionBlock; n: number; test: PaceTest | null; speeds: Speeds | null }) {
  const level = block.colorPct === null ? 0 : effortLevel(block.colorPct);
  // Contenido anterior a 2026.12 (sin porcentajes): la parte principal se muestra en km.
  const legacy = block.lines.length === 1 && block.lines[0]!.pct === null && block.kind === "main";
  const lines = legacy ? [{ ...block.lines[0]!, what: mainSetInKm(block.lines[0]!.what, speeds) ?? block.lines[0]!.what }] : block.lines;
  return (
    <li className={cx("rounded-xl border-l-4 px-3 py-2.5", LEVEL_CLASSES[level])}>
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink">{fmt(m.blockN, { n, name: BLOCK_NAMES[block.kind] })}</h4>
        {block.total ? <span className="tabular text-sm font-semibold text-ink">{fmt(m.total, { km: block.total })}</span> : null}
      </div>
      <ul className="mt-1.5 space-y-2">
        {lines.map((l, i) => (
          <li key={i} className={cx(i > 0 && "border-t border-line/70 pt-2")}>
            <p className="text-base font-semibold leading-snug text-ink">{l.what}</p>
            {l.pct !== null ? (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                <span className={cx("tabular font-bold", LEVEL_TEXT[effortLevel(l.pct)])}>
                  <span className="sr-only">{m.effort}: </span>
                  {effortLabel(l.pct)}
                </span>
                {test ? <span className="tabular text-ink">{fmt(m.pace, { pace: formatPace(paceForPct(test, l.pct)).replace("/km", "") })}</span> : null}
              </p>
            ) : null}
            {l.recovery ? <p className="mt-0.5 text-sm text-muted">{l.recovery}</p> : null}
            {l.note ? <p className="mt-0.5 text-sm text-muted">{l.note}</p> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Interior de una sesión: entrada en calor, parte principal y vuelta a la calma, cada una en su franja. */
export function SessionDetail({ day, test = null, speeds = null }: { day: Pick<DayRow, "warmup" | "main_set" | "cooldown">; test?: PaceTest | null; speeds?: Speeds | null }) {
  const blocks = sessionBlocks(day).filter((b) => b.lines.length > 0);
  return (
    <ol className="space-y-2">
      {blocks.map((b, i) => (
        <Block key={b.kind} block={b} n={i + 1} test={test} speeds={speeds} />
      ))}
    </ol>
  );
}
