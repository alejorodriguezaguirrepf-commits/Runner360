"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { IconHeart } from "@/components/ui/icons";
import { Button, cx } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { finishSessionAction } from "@/lib/actions/finish-session";
import { formatClock, maskClock, parseClock } from "@/lib/calculator";
import { parseKmInput, RPE_LABELS, splitSlots, summarize, type Split } from "@/lib/session-finish";

export type FinishedSession = { distanceM: number | null; durationS: number | null; rpe: number | null; splits: Split[] };

const km = (m: number) => (m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const kmInput = (m: number) => String(Math.round(m / 100) / 10).replace(".", ",");
const pace = (s: number | null) => (s ? `${formatClock(s)}/km` : "—");

/**
 * "Finalizar sesión": 1) distancia y tiempo de cada km (o solo el total), 2) RPE de la sesión,
 * 3) resumen. Se puede volver a abrir para corregir.
 */
export function FinishSession({ date, plannedKm, existing }: { date: string; plannedKm: number | null; existing: FinishedSession | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"splits" | "rpe" | "done">("splits");
  const startM = existing?.distanceM ?? (plannedKm ? Math.round(plannedKm * 10) * 100 : 5000);
  const [kmText, setKmText] = useState(kmInput(startM));
  const [mode, setMode] = useState<"splits" | "total">(existing && existing.splits.length === 0 && existing.durationS ? "total" : "splits");
  const [times, setTimes] = useState<string[]>(existing?.splits.map((s) => formatClock(s.seconds)) ?? []);
  const [totalText, setTotalText] = useState(existing?.durationS && !existing.splits.length ? formatClock(existing.durationS) : "");
  const [rpe, setRpe] = useState<number | null>(existing?.rpe ?? null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const meters = parseKmInput(kmText);
  const slots = useMemo(() => (meters ? splitSlots(meters) : []), [meters]);
  const seconds = slots.map((_, i) => parseClock(times[i] ?? ""));
  const filled = seconds.filter((s): s is number => s !== null).length;
  const totalS = mode === "total" ? parseClock(totalText) : filled === slots.length && slots.length ? seconds.reduce<number>((a, s) => a + (s ?? 0), 0) : null;
  const splits: Split[] = mode === "splits" && totalS ? slots.map((s, i) => ({ meters: s.meters, seconds: seconds[i]! })) : [];
  const summary = summarize(mode === "splits" ? splits : meters && totalS ? [{ meters, seconds: totalS }] : [], rpe);
  const partialS = seconds.reduce<number>((a, s) => a + (s ?? 0), 0);
  const step1Ok = Boolean(meters && totalS);

  const start = () => {
    setStep("splits");
    setError(null);
    setWorkoutId(null);
    setOpen(true);
  };

  const save = async () => {
    if (!meters || !totalS || !rpe) return;
    setBusy(true);
    setError(null);
    const r = await finishSessionAction({
      date,
      distanceM: meters,
      splits: mode === "splits" ? splits.map((s) => s.seconds) : [],
      totalS: mode === "total" ? totalS : undefined,
      rpe,
      comment: comment.trim() || undefined,
    });
    setBusy(false);
    if (r.ok) {
      setWorkoutId(r.workoutId);
      setStep("done");
      router.refresh();
    } else setError(r.message);
  };

  return (
    <>
      {existing?.durationS ? (
        <div className="mt-4 rounded-2xl border border-success/40 bg-success-bg p-3">
          <p className="font-bold text-success">✓ Sesión finalizada</p>
          <p className="tabular mt-1 text-sm text-ink">
            {existing.distanceM ? `${km(existing.distanceM)} km · ` : ""}
            {formatClock(existing.durationS)}
            {existing.distanceM ? ` · ${pace((existing.durationS * 1000) / existing.distanceM)}` : ""}
            {existing.rpe ? ` · RPE ${existing.rpe}` : ""}
          </p>
          <button type="button" onClick={start} className="mt-1 min-h-11 text-sm font-semibold text-primary-ink underline">
            Ver o corregir parciales y RPE
          </button>
        </div>
      ) : (
        <Button type="button" onClick={start} className="mt-4 w-full text-base">
          Finalizar sesión
        </Button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title={step === "done" ? "¡Sesión finalizada!" : step === "splits" ? "Parciales por km" : "¿Qué tan dura fue?"}>
        {step === "splits" ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paso 1 de 2</p>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Distancia total (km)</span>
              <input
                value={kmText}
                onChange={(e) => setKmText(e.target.value)}
                inputMode="decimal"
                className="tabular min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg font-bold"
                aria-invalid={!meters}
              />
              {!meters ? <span className="text-sm text-danger">Escribí los km con coma, por ejemplo 8,5.</span> : null}
            </label>
            <div role="radiogroup" aria-label="Qué tiempos cargar" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(
                [
                  ["splits", "Tiempo de cada km"],
                  ["total", "Solo el tiempo total"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={mode === v}
                  onClick={() => setMode(v)}
                  className={cx("min-h-11 rounded-lg text-sm font-semibold", mode === v ? "bg-surface text-ink shadow-sm" : "text-muted")}
                >
                  {l}
                </button>
              ))}
            </div>

            {mode === "splits" ? (
              <ol className="space-y-2">
                {slots.map((s, i) => {
                  const sec = seconds[i];
                  const isPartial = s.meters !== 1000;
                  return (
                    <li key={s.index} className="flex items-center gap-3">
                      <label htmlFor={`split-${i}`} className="w-24 shrink-0 text-sm font-semibold">
                        {isPartial ? `Últimos ${s.meters} m` : `Km ${s.index}`}
                      </label>
                      <input
                        id={`split-${i}`}
                        ref={(el) => {
                          inputs.current[i] = el;
                        }}
                        value={times[i] ?? ""}
                        onChange={(e) => {
                          const next = [...times];
                          next[i] = maskClock(e.target.value);
                          setTimes(next);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            inputs.current[i + 1]?.focus();
                          }
                        }}
                        inputMode="numeric"
                        enterKeyHint={i === slots.length - 1 ? "done" : "next"}
                        placeholder="5:30"
                        className="tabular min-h-12 w-28 rounded-xl border border-line bg-surface px-3 text-lg font-bold"
                      />
                      <span className="tabular text-sm text-muted">{sec ? (isPartial ? pace((sec * 1000) / s.meters) : "") : ""}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Tiempo total</span>
                <input
                  value={totalText}
                  onChange={(e) => setTotalText(maskClock(e.target.value))}
                  inputMode="numeric"
                  placeholder="45:00"
                  className="tabular min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-lg font-bold"
                />
                <span className="text-xs text-muted">Minutos y segundos (o h:mm:ss). Escribí solo los números: los dos puntos se ponen solos.</span>
              </label>
            )}

            <div
              // Pegado abajo de la hoja: el borde inferior tapa también el relleno del área que se desplaza.
              style={{ bottom: "calc(-1 * max(1rem, env(safe-area-inset-bottom)))" }}
              className="sticky -mx-4 -mb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <p className="tabular text-sm" aria-live="polite">
                {mode === "splits" ? `${filled} de ${slots.length} parciales · ` : ""}
                Total <strong>{totalS ? formatClock(totalS) : partialS ? formatClock(partialS) : "—"}</strong>
                {summary.paceS ? <> · ritmo medio <strong>{pace(summary.paceS)}</strong></> : null}
              </p>
              <Button type="button" onClick={() => setStep("rpe")} disabled={!step1Ok} className="mt-2 w-full text-base">
                Siguiente: RPE
              </Button>
            </div>
          </div>
        ) : step === "rpe" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paso 2 de 2</p>
              <button type="button" onClick={() => setStep("splits")} className="min-h-11 px-2 text-sm font-semibold text-primary-ink">← Parciales</button>
            </div>
            <p className="text-sm text-muted">El esfuerzo de toda la sesión, de 1 (muy suave) a 10 (máximo). Respondé unos minutos después de terminar.</p>
            <div role="radiogroup" aria-label="RPE de la sesión" className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={rpe === v}
                  aria-label={`${v}: ${RPE_LABELS[v]}`}
                  onClick={() => setRpe(v)}
                  className={cx(
                    "tabular min-h-14 rounded-2xl border text-xl font-extrabold transition",
                    rpe === v ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface hover:border-primary",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="min-h-7 text-center text-lg font-bold" aria-live="polite">{rpe ? RPE_LABELS[rpe] : "Elegí un número"}</p>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Comentario para tu entrenador (opcional)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ej.: mucho viento en la vuelta, me sentí bien en las pasadas…"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 sm:text-sm"
              />
            </label>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <Button type="button" onClick={save} disabled={!rpe || busy} className="w-full text-base">
              {busy ? "Guardando…" : "Guardar sesión"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            <dl className="grid grid-cols-2 gap-3 text-center">
              {[
                ["Distancia", meters ? `${km(meters)} km` : "—"],
                ["Tiempo", totalS ? formatClock(totalS) : "—"],
                ["Ritmo medio", pace(summary.paceS)],
                ["RPE", rpe ? `${rpe} · ${RPE_LABELS[rpe]}` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface-2 p-3">
                  <dt className="text-xs font-semibold text-muted">{k}</dt>
                  <dd className="tabular mt-1 text-lg font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
            {summary.load ? (
              <p className="text-center text-sm text-muted">
                Carga de la sesión: <strong className="text-ink">{summary.load}</strong> (RPE × minutos)
              </p>
            ) : null}
            {splits.length > 1 && summary.fastest !== null ? (
              <p className="text-center text-sm">
                Km más rápido: <strong>Km {slots[summary.fastest]!.index}</strong> ({pace(splits[summary.fastest]!.seconds)})
              </p>
            ) : null}
            <p className="text-center text-sm text-muted">Quedó guardada en tu progreso y la ve tu entrenador.</p>
            {workoutId ? (
              <Link
                href={`/pulsaciones?contexto=post_carrera&entrenamiento=${workoutId}`}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary px-4 text-sm font-semibold text-primary-ink hover:bg-surface-2"
              >
                <IconHeart /> Medir pulso post-carrera
              </Link>
            ) : null}
            <Button type="button" onClick={() => setOpen(false)} className="w-full text-base">Listo</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
