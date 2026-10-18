"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { INPUT } from "@/components/ui/form";
import { Button, Card, CardTitle, cx } from "@/components/ui/primitives";
import { savePaceTestAction } from "@/lib/actions/pace-test";
import { formatClock, formatDistance, paceAt, parseClock, parseDistance, parseKm, PERCENTS, timeAt } from "@/lib/calculator";

type Test = { meters: number; seconds: number };
type Rep = { id: number; reps: string; meters: string; pct: string };

const DEFAULT_DISTANCES = [200, 400, 1000, 5000];

function kmText(meters: number): string {
  return String(meters / 1000).replace(".", ",");
}

/** Calculadora: test (km + tiempo) → tabla de ritmos por porcentaje y calculadora de pasadas. */
export function PaceCalculator({ initial }: { initial: { meters: number; seconds: number; savedAt: string } | null }) {
  const [km, setKm] = useState(initial ? kmText(initial.meters) : "");
  const [time, setTime] = useState(initial ? formatClock(initial.seconds) : "");
  const [distances, setDistances] = useState<number[]>(DEFAULT_DISTANCES);
  const [newDistance, setNewDistance] = useState("");
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [reps, setReps] = useState<Rep[]>([{ id: 1, reps: "6", meters: "400", pct: "90" }]);
  const nextId = useRef(2);
  const [saveMsg, setSaveMsg] = useState<string | null>(initial ? "Se cargó tu último test." : null);
  const [, startTransition] = useTransition();
  const saved = useRef<Test | null>(initial ? { meters: initial.meters, seconds: initial.seconds } : null);

  const kmValue = parseKm(km);
  const timeValue = parseClock(time);
  const test: Test | null = kmValue && timeValue ? { meters: Math.round(kmValue * 1000), seconds: timeValue } : null;
  const kmError = km.trim() && !kmValue ? "Escribí los km con coma o punto (por ejemplo, 2,4)." : undefined;
  const timeError = time.trim() && !timeValue ? "Usá mm:ss o hh:mm:ss (por ejemplo, 12:30)." : undefined;
  const implausible = test && ((test.seconds * 1000) / test.meters < 90 || (test.seconds * 1000) / test.meters > 1800);

  // Guarda el test unos segundos después del último cambio (solo si es válido y distinto del guardado).
  useEffect(() => {
    if (!test || implausible) return;
    if (saved.current && saved.current.meters === test.meters && saved.current.seconds === test.seconds) return;
    const h = setTimeout(() => {
      startTransition(async () => {
        const res = await savePaceTestAction(test.meters, test.seconds);
        if (res.ok) saved.current = test;
        setSaveMsg(res.ok ? "Test guardado: se usa para mostrar tus planes en km." : (res.message ?? "No pudimos guardar tu test."));
      });
    }, 1200);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [test?.meters, test?.seconds, implausible]);

  const sorted = useMemo(() => [...distances].sort((a, b) => a - b), [distances]);

  function addDistance() {
    const m = parseDistance(newDistance);
    if (!m) {
      setDistanceError("Escribí una distancia como 400, 400 m o 5 km.");
      return;
    }
    setDistanceError(null);
    setDistances((d) => (d.includes(m) ? d : [...d, m]));
    setNewDistance("");
  }

  const kmId = useId();
  const timeId = useId();
  const distId = useId();

  return (
    <div className="space-y-6">
      {/* a) Test */}
      <Card>
        <CardTitle>Tu test</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={kmId} className="block text-sm font-semibold text-ink">Km del test</label>
            <input
              id={kmId}
              inputMode="decimal"
              autoComplete="off"
              placeholder="2,4"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              aria-invalid={kmError ? true : undefined}
              aria-describedby={kmError ? `${kmId}-e` : undefined}
              className={INPUT}
            />
            {kmError ? <p id={`${kmId}-e`} className="text-xs font-medium text-danger">{kmError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <label htmlFor={timeId} className="block text-sm font-semibold text-ink">Tiempo</label>
            <input
              id={timeId}
              inputMode="numeric"
              autoComplete="off"
              placeholder="12:00"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-invalid={timeError ? true : undefined}
              aria-describedby={timeError ? `${timeId}-e` : `${timeId}-h`}
              className={INPUT}
            />
            {timeError ? (
              <p id={`${timeId}-e`} className="text-xs font-medium text-danger">{timeError}</p>
            ) : (
              <p id={`${timeId}-h`} className="text-xs text-muted">mm:ss o hh:mm:ss</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted" aria-live="polite">
          {implausible ? "Revisá los datos: ese ritmo no parece posible." : test ? `Ritmo del test: ${formatClock(paceAt(test, 100))} /km.` : "Completá los km y el tiempo para ver los ritmos."}
          {saveMsg && test && !implausible ? <span className="block text-xs">{saveMsg}</span> : null}
        </p>
      </Card>

      {/* b) Tabla de ritmos */}
      <Card>
        <CardTitle>Tabla de ritmos</CardTitle>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor={distId} className="block text-sm font-semibold text-ink">Agregar distancia</label>
            <div className="flex gap-2">
              <input
                id={distId}
                autoComplete="off"
                placeholder="400 m o 5 km"
                value={newDistance}
                onChange={(e) => setNewDistance(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDistance();
                  }
                }}
                aria-invalid={distanceError ? true : undefined}
                aria-describedby={distanceError ? `${distId}-e` : `${distId}-h`}
                className={INPUT}
              />
              <Button type="button" variant="secondary" onClick={addDistance}>Agregar</Button>
            </div>
            {distanceError ? (
              <p id={`${distId}-e`} className="text-xs font-medium text-danger">{distanceError}</p>
            ) : (
              <p id={`${distId}-h`} className="text-xs text-muted">Sin unidad: menos de 100 se toma en km (5 = 5 km); desde 100, en metros.</p>
            )}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Distancias de la tabla">
          {sorted.map((m) => (
            <li key={m} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm font-semibold">
              {formatDistance(m)}
              <button
                type="button"
                onClick={() => setDistances((d) => d.filter((x) => x !== m))}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
                aria-label={`Quitar ${formatDistance(m)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {test && !implausible ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label="Tabla de ritmos por porcentaje">
            <table className="tabular w-full min-w-max text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="sticky left-0 bg-surface-2 px-3 py-2">%</th>
                  <th scope="col" className="px-3 py-2">Ritmo /km</th>
                  {sorted.map((m) => (
                    <th key={m} scope="col" className="px-3 py-2 text-right normal-case">{formatDistance(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERCENTS.map((p) => (
                  <tr key={p} className={p === 100 ? "font-bold" : undefined}>
                    <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-bold">{p} %</th>
                    <td className="px-3 py-2">{formatClock(paceAt(test, p))}</td>
                    {sorted.map((m) => (
                      <td key={m} className="px-3 py-2 text-right">{formatClock(timeAt(test, m, p))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">La tabla aparece cuando cargás un test válido.</p>
        )}
      </Card>

      {/* c) Pasadas */}
      <Card>
        <CardTitle>Calculadora de pasadas</CardTitle>
        <ol className="space-y-3">
          {reps.map((r, i) => {
            const n = Number(r.reps);
            const meters = Number(r.meters);
            const pct = Number(r.pct.replace(",", "."));
            const valid = test && !implausible && Number.isInteger(n) && n >= 1 && n <= 100 && meters >= 50 && meters <= 100_000 && pct >= 30 && pct <= 130;
            return (
              <li key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Bloque {i + 1}</p>
                  <button
                    type="button"
                    onClick={() => setReps((rs) => rs.filter((x) => x.id !== r.id))}
                    className="min-h-11 rounded-lg px-2 text-sm font-semibold text-muted underline hover:text-ink"
                  >
                    Quitar<span className="sr-only"> bloque {i + 1}</span>
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <RepField label="Repeticiones" value={r.reps} onChange={(v) => setReps((rs) => rs.map((x) => (x.id === r.id ? { ...x, reps: v } : x)))} />
                  <RepField label="Metros" value={r.meters} onChange={(v) => setReps((rs) => rs.map((x) => (x.id === r.id ? { ...x, meters: v } : x)))} />
                  <RepField label="%" value={r.pct} onChange={(v) => setReps((rs) => rs.map((x) => (x.id === r.id ? { ...x, pct: v } : x)))} />
                </div>
                <p className={cx("mt-2 text-sm", valid ? "text-ink" : "text-muted")} aria-live="polite">
                  {valid ? (
                    <>
                      <span className="tabular font-bold">{n} × {formatDistance(meters)} en {formatClock(timeAt(test, meters, pct))}</span>
                      <span className="tabular text-muted"> · ritmo {formatClock(paceAt(test, pct))} /km</span>
                    </>
                  ) : test ? (
                    "Completá repeticiones, metros y porcentaje."
                  ) : (
                    "Cargá tu test para calcular."
                  )}
                </p>
              </li>
            );
          })}
        </ol>
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => setReps((rs) => [...rs, { id: nextId.current++, reps: "4", meters: "1000", pct: "85" }])}
        >
          Agregar bloque
        </Button>
      </Card>
    </div>
  );
}

function RepField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-muted">{label}</label>
      <input id={id} inputMode="numeric" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} className={INPUT} />
    </div>
  );
}
