"use client";

import {
  effortLabel,
  effortLevel,
  formatPace,
  mainSetInKm,
  paceForPct,
  plausibleSplit,
  sessionBlocks,
  sessionTimes,
  sessionTotals,
  type Speeds,
} from "@runner360/plan-library";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { BLOCK_NAMES, LEVEL_CLASSES, LEVEL_TEXT } from "@/components/library/session-detail";
import { OpenWellnessButton } from "@/components/training/wellness-checkin";
import { ClockInput } from "@/components/ui/clock-input";
import { IconHeart } from "@/components/ui/icons";
import { Button, cx } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { saveSessionLogAction } from "@/lib/actions/session-log";
import { formatClock, parseClock } from "@/lib/calculator";
import { RPE_LABELS } from "@/lib/session-finish";

const w = t.library.workout;
const km = (m: number) => (m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export type SavedSession = { workoutId: string; rpe: number | null; avgHr: number | null; maxHr: number | null; splits: number[] };
type Draft = { values: string[]; checked: boolean[]; rpe: number | null; avgHr: string; maxHr: string };
type Day = { warmup: string | null; main_set: string | null; cooldown: string | null };

const draftKey = (date: string) => `runner360.sessionDraft.${date}`;
const noopSubscribe = () => () => {};

/**
 * La sesión del plan con el registro adentro: cada trabajo tiene su tiempo prescripto (con el test),
 * un casillero para anotar el tiempo real y un tilde para darlo por hecho. Al pie, RPE, FC media y
 * máxima y «Guardar»: el registro del día se arma solo. Mientras tanto, lo anotado queda guardado en
 * el dispositivo (si se cierra la app, no se pierde).
 */
export function SessionLog({
  date,
  day,
  test,
  speeds,
  canSave,
  needsWellness,
  saved,
}: {
  date: string;
  day: Day;
  test: { meters: number; seconds: number } | null;
  speeds: Speeds | null;
  /** Hoy o un día anterior, con el plan activo. */
  canSave: boolean;
  needsWellness: boolean;
  saved: SavedSession | null;
}) {
  const router = useRouter();
  const blocks = sessionBlocks(day).filter((b) => b.lines.length > 0);
  const times = sessionTimes(day, test);
  const rows = times.rows;
  const editable = rows.flatMap((r, i) => (r.editable ? [i] : []));

  // Punto de partida: lo guardado en la base, o el borrador del dispositivo, o vacío.
  const base = (): Draft => {
    const values = rows.map(() => "");
    const fromDb = Boolean(saved && saved.splits.length === editable.length);
    if (saved && fromDb) editable.forEach((i, n) => (values[i] = formatClock(saved.splits[n]!)));
    return {
      values,
      checked: rows.map(() => Boolean(saved)),
      rpe: saved?.rpe ?? null,
      avgHr: saved?.avgHr ? String(saved.avgHr) : "",
      maxHr: saved?.maxHr ? String(saved.maxHr) : "",
    };
  };
  const stored = useSyncExternalStore(
    noopSubscribe,
    () => {
      try {
        return window.localStorage.getItem(draftKey(date));
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [edited, setEdited] = useState<Draft | null>(null);
  const draft: Draft = edited ?? (stored && !saved ? safeDraft(stored, rows.length) : null) ?? base();
  const update = (next: Draft) => {
    setEdited(next);
    try {
      window.localStorage.setItem(draftKey(date), JSON.stringify(next));
    } catch {
      // Sin almacenamiento: el borrador vive mientras la página esté abierta.
    }
  };

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ meters: number; seconds: number; workoutId: string } | null>(null);

  const actual = draft.values.map((v) => parseClock(v));
  const wrong = draft.values.map((v, i) => v !== "" && (actual[i] === null || (rows[i]!.meters !== null && !plausibleSplit(rows[i]!.meters!, actual[i]!))));
  const totals = sessionTotals(times, actual);
  const hr = (v: string) => (v ? Number(v) : null);
  const hrWrong = [draft.avgHr, draft.maxHr].some((v) => v !== "" && (!/^\d{2,3}$/.test(v) || Number(v) < 30 || Number(v) > 250));
  const hrOrder = Boolean(draft.avgHr && draft.maxHr && Number(draft.avgHr) > Number(draft.maxHr));
  const marked = draft.checked.filter(Boolean).length;

  const tick = (i: number) => {
    const r = rows[i]!;
    const checked = [...draft.checked];
    const values = [...draft.values];
    if (checked[i]) checked[i] = false;
    else {
      if (wrong[i]) return;
      // Sin tiempo anotado: se da por hecho como estaba prescripto.
      if (r.editable && !values[i] && r.seconds !== null) values[i] = formatClock(r.seconds);
      checked[i] = true;
    }
    update({ ...draft, values, checked });
  };

  const save = async () => {
    if (!draft.rpe || wrong.some(Boolean) || hrWrong || hrOrder) return;
    setBusy(true);
    setError(null);
    const r = await saveSessionLogAction({
      date,
      actual: actual.map((a, i) => (rows[i]!.editable ? a : null)),
      rpe: draft.rpe,
      avgHr: hr(draft.avgHr),
      maxHr: hr(draft.maxHr),
    });
    setBusy(false);
    if (r.ok) {
      setDone({ meters: r.meters, seconds: r.seconds, workoutId: r.workoutId });
      setEdited({ ...draft, checked: rows.map(() => true) });
      try {
        window.localStorage.removeItem(draftKey(date));
      } catch {
        // nada
      }
      router.refresh();
    } else setError(r.message);
  };

  // Índice de la primera línea de cada bloque (los tiempos se ubican por línea).
  const lineStart = blocks.map((_, bi) => blocks.slice(0, bi).reduce((a, b) => a + b.lines.length, 0));
  return (
    <div className="space-y-2">
      {canSave && rows.length ? (
        <p className="flex items-center justify-end gap-2 px-3 text-xs font-semibold text-muted" aria-hidden>
          <span className="w-16 text-right">Prescripto</span>
          <span className="w-[4.75rem] text-center">Tu tiempo</span>
          <span className="w-11 text-center">Hecho</span>
        </p>
      ) : null}
      <ol className="space-y-2">
        {blocks.map((b, bi) => {
          const level = b.colorPct === null ? 0 : effortLevel(b.colorPct);
          const legacy = b.lines.length === 1 && b.lines[0]!.pct === null && b.kind === "main";
          return (
            <li key={b.kind} className={cx("rounded-xl border-l-4 px-3 py-2.5", LEVEL_CLASSES[level])}>
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink">{fmt(w.blockN, { n: bi + 1, name: BLOCK_NAMES[b.kind] })}</h4>
                {b.total ? <span className="tabular text-sm font-semibold text-ink">{fmt(w.total, { km: b.total })}</span> : null}
              </div>
              <ul className="mt-1.5 space-y-2">
                {b.lines.map((l, li) => {
                  const idx = lineStart[bi]! + li;
                  const what = legacy ? (mainSetInKm(l.what, speeds) ?? l.what) : l.what;
                  const lineRows = rows.map((r, i) => ({ r, i })).filter((x) => x.r.line === idx);
                  return (
                    <li key={li} className={cx(li > 0 && "border-t border-line/70 pt-2")}>
                      <p className="text-base font-semibold leading-snug text-ink">{what}</p>
                      {l.pct !== null ? (
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                          <span className={cx("tabular font-bold", LEVEL_TEXT[effortLevel(l.pct)])}>{effortLabel(l.pct)}</span>
                          {test ? <span className="tabular text-ink">{fmt(w.pace, { pace: formatPace(paceForPct(test, l.pct)).replace("/km", "") })}</span> : null}
                        </p>
                      ) : null}
                      {l.recovery ? <p className="mt-0.5 text-sm text-muted">{l.recovery}</p> : null}
                      {l.note ? <p className="mt-0.5 text-sm text-muted">{l.note}</p> : null}
                      {lineRows.length && (canSave || test) ? (
                        <ul className="mt-1.5 space-y-1">
                          {lineRows.map(({ r, i }) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-xs text-muted">{r.rep ? `${r.rep}/${r.reps}` : r.embedded ? "Dentro del tramo" : ""}</span>
                              <span className="tabular w-16 text-right text-sm font-semibold text-ink">{r.seconds !== null ? formatClock(r.seconds) : "—"}</span>
                              {canSave ? (
                                <>
                                  {r.editable ? (
                                    <ClockInput
                                      value={draft.values[i] ?? ""}
                                      onChange={(v) => update({ ...draft, values: draft.values.map((x, j) => (j === i ? v : x)) })}
                                      disabled={draft.checked[i]}
                                      placeholder={r.seconds !== null ? formatClock(r.seconds) : "0:00"}
                                      aria-label={`Tu tiempo en ${r.label}${r.rep ? `, ${r.rep} de ${r.reps}` : ""}`}
                                      aria-invalid={wrong[i]}
                                      className={cx(
                                        "tabular min-h-11 w-[4.75rem] rounded-lg border bg-surface px-2 text-right text-base font-semibold placeholder:font-normal placeholder:text-muted/60 disabled:bg-surface-2 disabled:text-ink",
                                        wrong[i] ? "border-danger" : "border-line",
                                      )}
                                    />
                                  ) : (
                                    <span className="w-[4.75rem]" aria-hidden />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => tick(i)}
                                    aria-pressed={draft.checked[i]}
                                    aria-label={`${draft.checked[i] ? "Desmarcar" : "Marcar como hecho"}: ${r.label}${r.rep ? `, ${r.rep} de ${r.reps}` : ""}`}
                                    className={cx(
                                      "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border text-lg font-extrabold",
                                      draft.checked[i] ? "border-success bg-success text-surface" : "border-line bg-surface text-muted hover:border-primary",
                                    )}
                                  >
                                    ✓
                                  </button>
                                </>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {canSave ? (
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
          {!test ? (
            <p className="text-xs text-muted">
              Sin test cargado no hay tiempos prescriptos: anotá los tuyos o guardá igual (se toma la estimación del plan).{" "}
              <Link href="/calculadora" className="font-semibold text-primary-ink underline">Cargar test</Link>
            </p>
          ) : null}
          <p className="tabular text-sm" aria-live="polite">
            {rows.length ? `${marked} de ${rows.length} trabajos con ✓ · ` : ""}
            {totals ? (
              <>
                Total <strong>{totals.meters ? `${km(totals.meters)} km · ` : ""}{formatClock(totals.seconds)}</strong>
              </>
            ) : (
              "Total: estimación del plan"
            )}
          </p>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">RPE de la sesión</legend>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={draft.rpe === n}
                  aria-label={`${n}: ${RPE_LABELS[n]}`}
                  onClick={() => update({ ...draft, rpe: n })}
                  className={cx("tabular min-h-11 rounded-lg border text-sm font-bold", draft.rpe === n ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface hover:border-primary")}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted" aria-live="polite">{draft.rpe ? RPE_LABELS[draft.rpe] : "1 = muy suave · 10 = máximo"}</p>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["avgHr", "FC media"],
                ["maxHr", "FC máxima"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="block space-y-1 text-sm">
                <span className="font-semibold">{label} <span className="font-normal text-muted">(lpm)</span></span>
                <input
                  value={draft[k]}
                  onChange={(e) => update({ ...draft, [k]: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  inputMode="numeric"
                  placeholder={k === "avgHr" ? "150" : "175"}
                  className="tabular min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base font-semibold placeholder:font-normal placeholder:text-muted/60"
                />
              </label>
            ))}
          </div>
          <p className="-mt-1 text-xs text-muted">La frecuencia cardíaca es opcional.</p>
          {wrong.some(Boolean) ? <p className="text-sm text-danger">Revisá los tiempos en rojo: minutos y segundos del trabajo completo.</p> : null}
          {hrWrong ? <p className="text-sm text-danger">La frecuencia cardíaca va de 30 a 250 lpm.</p> : null}
          {hrOrder ? <p className="text-sm text-danger">La FC media no puede ser mayor que la máxima.</p> : null}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          {done ? (
            <div role="status" className="rounded-xl border border-success/40 bg-success-bg p-3 text-sm">
              <p className="font-bold text-success">✓ Sesión guardada</p>
              <p className="tabular mt-0.5 text-ink">
                {done.meters ? `${km(done.meters)} km · ` : ""}
                {formatClock(done.seconds)} · RPE {draft.rpe}
                {draft.avgHr ? ` · FC ${draft.avgHr}${draft.maxHr ? `/${draft.maxHr}` : ""}` : ""}
              </p>
              <Link href={`/pulsaciones?contexto=post_carrera&entrenamiento=${done.workoutId}`} className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-primary-ink">
                <IconHeart /> Medir pulso post-carrera
              </Link>
            </div>
          ) : null}
          {needsWellness ? (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-sm font-semibold">Antes de guardar, completá el wellness de hoy.</p>
              <OpenWellnessButton className="mt-2 w-full">Completar wellness</OpenWellnessButton>
            </div>
          ) : (
            <Button type="button" onClick={save} disabled={!draft.rpe || busy || wrong.some(Boolean) || hrWrong || hrOrder} className="w-full text-base">
              {busy ? "Guardando…" : saved || done ? "Guardar cambios" : "Guardar"}
            </Button>
          )}
          {!draft.rpe && !needsWellness ? <p className="-mt-1 text-center text-xs text-muted">Elegí el RPE para guardar.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function safeDraft(raw: string, n: number): Draft | null {
  try {
    const d = JSON.parse(raw) as Draft;
    if (!Array.isArray(d.values) || d.values.length !== n || !Array.isArray(d.checked) || d.checked.length !== n) return null;
    return { values: d.values.map(String), checked: d.checked.map(Boolean), rpe: typeof d.rpe === "number" ? d.rpe : null, avgHr: String(d.avgHr ?? ""), maxHr: String(d.maxHr ?? "") };
  } catch {
    return null;
  }
}
