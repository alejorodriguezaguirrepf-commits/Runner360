"use client";
import { useId, useMemo, useState } from "react";
import { evenSplits, finishTimeAtPace, targetPace } from "@runner360/training-engine";
import { formatDuration, formatKm, formatPace, parseDuration, parseKmToMeters, RACE_DISTANCE_METERS } from "@runner360/shared";
import { Field, Input, Select } from "@/components/ui/field";

type Mode = "pace" | "time";

/** Calculadora de ritmo objetivo y parciales. Todo lo que muestra es una ESTIMACIÓN a ritmo parejo. */
export function PaceCalculator() {
  const id = useId();
  const [mode, setMode] = useState<Mode>("pace");
  const [distance, setDistance] = useState("10");
  const [time, setTime] = useState("50:00");
  const [pace, setPace] = useState("5:00");
  const [split, setSplit] = useState("1000");

  const distanceM = parseKmToMeters(distance);
  const result = useMemo(() => {
    if (!distanceM) return { error: "Ingresá una distancia válida en km (por ejemplo 21,097)." } as const;
    if (mode === "pace") {
      const t = parseDuration(time);
      if (!t) return { error: "Ingresá el tiempo como mm:ss o h:mm:ss." } as const;
      const p = targetPace(distanceM, t)!;
      return { paceS: p, timeS: t } as const;
    }
    const p = parseDuration(pace);
    if (!p) return { error: "Ingresá el ritmo como m:ss por km." } as const;
    return { paceS: p, timeS: finishTimeAtPace(distanceM, p)! } as const;
  }, [distanceM, mode, time, pace]);

  const splits = "error" in result || !distanceM ? [] : evenSplits(distanceM, result.timeS, Number(split));

  return (
    <div className="space-y-6">
      <fieldset className="flex flex-wrap gap-2" aria-label="¿Qué querés calcular?">
        {(
          [
            ["pace", "Ritmo para un tiempo objetivo"],
            ["time", "Tiempo final a un ritmo"],
          ] as const
        ).map(([m, label]) => (
          <label key={m} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium ${mode === m ? "border-navy bg-navy text-white" : "border-line bg-white text-navy"}`}>
            <input type="radio" name={`${id}-mode`} value={m} checked={mode === m} onChange={() => setMode(m)} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Distancia (km)" htmlFor={`${id}-d`} hint="Ej.: 5 · 10 · 21,097 · 42,195">
          <Input id={`${id}-d`} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} list={`${id}-dl`} />
          <datalist id={`${id}-dl`}>
            {Object.values(RACE_DISTANCE_METERS).map((m) => (
              <option key={m} value={(m / 1000).toString().replace(".", ",")} />
            ))}
          </datalist>
        </Field>
        {mode === "pace" ? (
          <Field label="Tiempo objetivo" htmlFor={`${id}-t`} hint="mm:ss o h:mm:ss">
            <Input id={`${id}-t`} inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        ) : (
          <Field label="Ritmo (min/km)" htmlFor={`${id}-p`} hint="m:ss">
            <Input id={`${id}-p`} inputMode="numeric" value={pace} onChange={(e) => setPace(e.target.value)} />
          </Field>
        )}
        <Field label="Parciales cada" htmlFor={`${id}-s`}>
          <Select id={`${id}-s`} value={split} onChange={(e) => setSplit(e.target.value)}>
            <option value="1000">1 km</option>
            <option value="2000">2 km</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
          </Select>
        </Field>
      </div>

      <div aria-live="polite">
        {"error" in result ? (
          <p className="text-sm font-medium text-danger">{result.error}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-navy p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-white/70">Ritmo estimado</p>
              <p className="tabular mt-1 text-3xl font-bold text-lime" data-testid="calc-pace">{formatPace(result.paceS)}</p>
            </div>
            <div className="rounded-xl bg-navy p-5 text-white">
              <p className="text-xs uppercase tracking-wide text-white/70">Tiempo final estimado</p>
              <p className="tabular mt-1 text-3xl font-bold text-lime" data-testid="calc-time">{formatDuration(result.timeS)}</p>
            </div>
          </div>
        )}
      </div>

      {splits.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">Parciales estimados a ritmo parejo</caption>
            <thead className="bg-surface text-left text-xs uppercase text-muted">
              <tr>
                <th scope="col" className="px-4 py-2">Parcial</th>
                <th scope="col" className="px-4 py-2">Hasta</th>
                <th scope="col" className="px-4 py-2">Tiempo del parcial</th>
                <th scope="col" className="px-4 py-2">Acumulado</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {splits.map((s) => (
                <tr key={s.index}>
                  <td className="px-4 py-2">{s.index}</td>
                  <td className="px-4 py-2">{formatKm(s.cumulativeDistanceM, 3)}</td>
                  <td className="px-4 py-2">{formatDuration(s.splitTimeS)}</td>
                  <td className="px-4 py-2 font-semibold">{formatDuration(s.cumulativeTimeS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-xs text-muted">
        Estimaciones a ritmo parejo, sin considerar desnivel, clima ni fatiga. No son predicciones ni garantías de rendimiento.
      </p>
    </div>
  );
}
