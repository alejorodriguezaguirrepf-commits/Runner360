"use client";

import { buildEvenSplits, DISTANCE_METERS, kmInputToMeters, paceForTarget, parseDuration, timeFromPace } from "@runner360/training-engine";
import { DISTANCE_LABELS, formatDuration, formatKm, formatPaceLabel } from "@runner360/shared";
import { useActionState, useState } from "react";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Alert, Stat } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { addCompetitionAction, saveResultAction } from "@/lib/actions/modules";

const distanceOptions = Object.entries(DISTANCE_LABELS).map(([value, label]) => ({ value, label }));

export function CompetitionForm() {
  const [state, action] = useActionState(addCompetitionAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="name" maxLength={120} error={e.name} />
        <TextField label="Fecha" name="eventDate" type="date" error={e.eventDate} />
        <SelectField label="Distancia estándar" name="distanceCode" placeholder="Otra distancia" options={distanceOptions} />
        <TextField label="Distancia (km)" name="distanceKm" inputMode="decimal" hint="Dejalo vacío si elegiste una distancia estándar." error={e.distanceKm} />
        <TextField label="Ubicación (opcional)" name="location" maxLength={120} />
        <TextField label="Tiempo objetivo (opcional)" name="targetTime" placeholder="1:55:00" error={e.targetTime} />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Guardar competencia</SubmitButton>
    </form>
  );
}

export function ResultForm({ competitionId }: { competitionId: string }) {
  const [state, action] = useActionState(saveResultAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="mt-3 space-y-3" noValidate>
      <input type="hidden" name="competitionId" value={competitionId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Estado" name="status" options={[{ value: "completed", label: "Finalicé" }, { value: "dnf", label: "No finalicé" }, { value: "dns", label: "No largué" }]} />
        <TextField label="Tiempo final" name="finishTime" placeholder="52:10" error={e.finishTime} />
      </div>
      <TextAreaField label="Parciales por km (opcional)" name="splits" rows={2} placeholder="5:10, 5:05, …" error={e.splits} />
      <CheckboxField name="isOfficial" label="Es el tiempo oficial de la organización" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Guardar resultado</SubmitButton>
    </form>
  );
}

/** Calculadora con las mismas funciones puras del motor. Resultados = estimaciones, no garantías. */
export function PaceCalculator() {
  const [distance, setDistance] = useState("10K");
  const [customKm, setCustomKm] = useState("");
  const [mode, setMode] = useState<"time" | "pace">("time");
  const [input, setInput] = useState("50:00");
  const [splitKm, setSplitKm] = useState("1");

  const meters = distance === "custom" ? kmInputToMeters(customKm) : DISTANCE_METERS[distance as keyof typeof DISTANCE_METERS];
  const parsed = parseDuration(input);
  let totalS: number | null = null;
  let pace: number | null = null;
  if (meters && parsed) {
    if (mode === "time") {
      totalS = parsed;
      pace = paceForTarget(meters, parsed);
    } else {
      pace = parsed;
      totalS = timeFromPace(meters, parsed);
    }
  }
  const splitM = kmInputToMeters(splitKm);
  const splits = meters && totalS && splitM && splitM >= 100 && meters / splitM <= 100 ? buildEvenSplits(meters, totalS, splitM) : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <SelectField label="Distancia" name="calcDistance" value={distance} onChange={(e) => setDistance(e.target.value)} options={[...distanceOptions, { value: "custom", label: "Otra" }]} />
        {distance === "custom" ? <TextField label="Km" name="calcKm" inputMode="decimal" value={customKm} onChange={(e) => setCustomKm(e.target.value)} /> : null}
        <SelectField label="Calcular a partir de" name="calcMode" value={mode} onChange={(e) => setMode(e.target.value as "time" | "pace")} options={[{ value: "time", label: "Tiempo objetivo" }, { value: "pace", label: "Ritmo (min/km)" }]} />
        <TextField label={mode === "time" ? "Tiempo (h:mm:ss)" : "Ritmo (m:ss)"} name="calcInput" value={input} onChange={(e) => setInput(e.target.value)} />
        <TextField label="Parcial cada (km)" name="calcSplit" inputMode="decimal" value={splitKm} onChange={(e) => setSplitKm(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3" aria-live="polite">
        <Stat label="Tiempo estimado" value={totalS ? formatDuration(totalS) : "—"} />
        <Stat label="Ritmo necesario" value={formatPaceLabel(pace)} />
      </div>
      {splits.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-navy-700">Ver parciales ({splits.length})</summary>
          <table className="mt-2 w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="py-1">Parcial</th><th>Distancia acumulada</th><th>Tiempo del parcial</th><th>Acumulado</th></tr></thead>
            <tbody className="divide-y divide-line">
              {splits.map((s) => (
                <tr key={s.index}><td className="py-1">{s.index}</td><td className="tabular">{formatKm(s.cumulativeDistanceM)}</td><td className="tabular">{formatDuration(s.splitTimeS)}</td><td className="tabular">{formatDuration(s.cumulativeTimeS)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
      <Alert tone="info">Son cálculos de ritmo parejo. No son predicciones ni garantías de rendimiento.</Alert>
    </div>
  );
}
