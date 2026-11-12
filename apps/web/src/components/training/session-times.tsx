"use client";

import { effortLabel, plausibleSplit, sessionTotals, type SessionTimes } from "@runner360/plan-library";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OpenWellnessButton } from "@/components/training/wellness-checkin";
import { IconHeart } from "@/components/ui/icons";
import { Button, cx } from "@/components/ui/primitives";
import { saveSessionLogAction } from "@/lib/actions/session-log";
import { formatClock, maskClock, parseClock } from "@/lib/calculator";
import { RPE_LABELS } from "@/lib/session-finish";

const BLOCK = { warmup: "Entrada en calor", main: "Parte principal", cooldown: "Vuelta a la calma" } as const;
const km = (m: number) => (m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });

export type SavedSession = { rpe: number | null; meters: number | null; seconds: number | null; splits: number[]; workoutId: string };

/**
 * Tiempos de la sesión en dos columnas: lo prescripto (con el test, según el porcentaje de cada tramo)
 * y lo real, para corregir solo lo que no salió como estaba. Al pie, RPE y «Guardar sesión»: el
 * registro del día se arma solo.
 */
export function SessionTimesTable({
  date,
  times,
  hasTest,
  canSave,
  needsWellness,
  saved,
  defaultOpen,
}: {
  date: string;
  times: SessionTimes;
  hasTest: boolean;
  /** Día de hoy o anterior, con el plan activo. */
  canSave: boolean;
  /** Hoy sin el wellness respondido: primero el cuestionario. */
  needsWellness: boolean;
  saved: SavedSession | null;
  defaultOpen: boolean;
}) {
  const router = useRouter();
  const editableIdx = times.rows.flatMap((r, i) => (r.editable ? [i] : []));
  // Lo guardado vuelve a la columna «Real» (si coincide con los tramos de la sesión).
  const [values, setValues] = useState<string[]>(() => {
    const out: string[] = times.rows.map(() => "");
    if (saved && saved.splits.length === editableIdx.length)
      editableIdx.forEach((i, n) => {
        if (saved.splits[n] !== times.rows[i]!.seconds) out[i] = formatClock(saved.splits[n]!);
      });
    return out;
  });
  const [rpe, setRpe] = useState<number | null>(saved?.rpe ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ meters: number; seconds: number; workoutId: string } | null>(null);

  const actual = values.map((v) => parseClock(v));
  const totals = sessionTotals(times, actual);
  // Vacío = como estaba prescripto. Un tiempo mal escrito o imposible para esa distancia no se guarda.
  const wrong = values.map((v, i) => {
    if (v.trim() === "") return false;
    const a = actual[i];
    const m = times.rows[i]!.meters;
    return a === null || a === undefined || (m !== null && !plausibleSplit(m, a));
  });
  const invalid = wrong.some(Boolean);
  if (!times.rows.length) return null;

  const save = async () => {
    if (!rpe || invalid) return;
    setBusy(true);
    setError(null);
    const r = await saveSessionLogAction({ date, actual: actual.map((a, i) => (times.rows[i]!.editable ? a : null)), rpe });
    setBusy(false);
    if (r.ok) {
      setDone({ meters: r.meters, seconds: r.seconds, workoutId: r.workoutId });
      router.refresh();
    } else setError(r.message);
  };

  return (
    <details open={defaultOpen} className="group/times mt-4 rounded-xl border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex-1 font-bold">{canSave ? "Tiempos y registro de la sesión" : "Tiempos de la sesión"}</span>
        {saved ? <span className="rounded-md bg-success-bg px-1.5 py-0.5 text-xs font-bold text-success">✓ Guardada</span> : null}
        <span aria-hidden className="text-muted transition group-open/times:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-2">
        {!hasTest ? (
          <p className="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            Para ver el tiempo de cada pasada, cargá tu test en{" "}
            <Link href="/calculadora" className="font-semibold text-primary-ink underline">Test/%</Link>.
            {canSave ? " Igual podés cargar tus tiempos reales." : ""}
          </p>
        ) : null}
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th scope="col" className="py-1 pr-2 font-semibold">Tramo</th>
              <th scope="col" className="w-20 py-1 pr-2 text-right font-semibold">Prescripto</th>
              {canSave ? <th scope="col" className="w-24 py-1 text-right font-semibold">Real</th> : null}
            </tr>
          </thead>
          <tbody>
            {times.rows.map((r, i) => {
              const header = i === 0 || times.rows[i - 1]!.block !== r.block ? BLOCK[r.block] : null;
              const a = actual[i];
              const diff = a !== null && a !== undefined && r.seconds !== null ? a - r.seconds : null;
              return [
                header ? (
                  <tr key={`h-${r.block}`}>
                    <th colSpan={canSave ? 3 : 2} scope="colgroup" className="pt-2 pb-0.5 text-xs font-bold uppercase tracking-wider text-primary-ink">
                      {header}
                    </th>
                  </tr>
                ) : null,
                <tr key={i} className={cx("border-t border-line/70", r.embedded && "text-muted")}>
                  <th scope="row" className="py-1.5 pr-2 font-normal">
                    <span className="font-semibold text-ink">{r.label}</span>
                    {r.rep ? <span className="text-muted"> · {r.rep}/{r.reps}</span> : null}
                    {r.pct ? <span className="block text-xs text-muted">{effortLabel(r.pct)}</span> : null}
                  </th>
                  <td className="tabular py-1.5 pr-2 text-right font-semibold">{r.seconds !== null ? formatClock(r.seconds) : "—"}</td>
                  {canSave ? (
                    <td className="py-1.5 text-right">
                      {r.editable ? (
                        <>
                          <input
                            value={values[i] ?? ""}
                            onChange={(e) => setValues((vs) => vs.map((x, j) => (j === i ? maskClock(e.target.value) : x)))}
                            inputMode="numeric"
                            placeholder={r.seconds !== null ? formatClock(r.seconds) : "m:ss"}
                            aria-label={`Tiempo real de ${r.label}${r.rep ? ` ${r.rep} de ${r.reps}` : ""}`}
                            aria-invalid={wrong[i]}
                            className="tabular min-h-10 w-20 rounded-lg border bg-surface px-2 text-right text-base font-semibold placeholder:font-normal placeholder:text-muted/60 sm:text-sm aria-[invalid=true]:border-danger [&:not([aria-invalid=true])]:border-line"
                          />
                          {wrong[i] ? <span className="block text-xs text-danger">Revisá</span> : diff ? (
                            <span className={cx("block text-xs", diff < 0 ? "text-success" : "text-warning")}>
                              {diff < 0 ? "−" : "+"}
                              {formatClock(Math.abs(diff))}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="tabular text-muted">{r.seconds !== null ? formatClock(r.seconds) : "—"}</span>
                      )}
                    </td>
                  ) : null}
                </tr>,
              ];
            })}
          </tbody>
        </table>
        {times.pausesS ? <p className="mt-1 text-xs text-muted">Pausas entre pasadas: {formatClock(times.pausesS)} (se suman al tiempo total).</p> : null}

        {canSave ? (
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            <p className="tabular text-sm" aria-live="polite">
              {totals ? (
                <>
                  Total: <strong>{totals.meters ? `${km(totals.meters)} km · ` : ""}{formatClock(totals.seconds)}</strong>
                </>
              ) : (
                "Sin test: se guarda la distancia y la duración estimadas del plan (o cargá tus tiempos)."
              )}
            </p>
            <p className="text-xs text-muted">Dejá vacío lo que hiciste como estaba prescripto: se guarda igual.</p>
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">RPE de la sesión</legend>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={rpe === n}
                    aria-label={`${n}: ${RPE_LABELS[n]}`}
                    onClick={() => setRpe(n)}
                    className={cx(
                      "tabular min-h-11 rounded-lg border text-sm font-bold",
                      rpe === n ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface hover:border-primary",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1 min-h-5 text-xs text-muted" aria-live="polite">{rpe ? RPE_LABELS[rpe] : "1 = muy suave · 10 = máximo"}</p>
            </fieldset>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            {invalid ? <p className="text-sm text-danger">Revisá los tiempos marcados: minutos y segundos del tramo completo (por ejemplo, 13:05 para 3 km).</p> : null}
            {done ? (
              <div role="status" className="rounded-xl border border-success/40 bg-success-bg p-3 text-sm">
                <p className="font-bold text-success">✓ Sesión guardada en tu registro</p>
                <p className="tabular mt-0.5 text-ink">{done.meters ? `${km(done.meters)} km · ` : ""}{formatClock(done.seconds)} · RPE {rpe}</p>
                <Link href={`/pulsaciones?contexto=post_carrera&entrenamiento=${done.workoutId}`} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-primary-ink">
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
              <Button type="button" onClick={save} disabled={!rpe || busy || invalid} className="w-full text-base">
                {busy ? "Guardando…" : saved || done ? "Actualizar sesión" : "Guardar sesión"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </details>
  );
}
