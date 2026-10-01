"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createCompetitionAction, saveResultAction } from "@/app/app/competencias/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/form";

export function CompetitionForm({ activePlanId }: { activePlanId: string | null }) {
  const [state, action] = useActionState(createCompetitionAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Nombre" htmlFor="name" error={fe.name}><Input id="name" name="name" required maxLength={120} invalid={!!fe.name} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Distancia (km)" htmlFor="distanceKm" error={fe.distanceM}><Input id="distanceKm" name="distanceKm" inputMode="decimal" placeholder="21,097" required invalid={!!fe.distanceM} /></Field>
        <Field label="Fecha" htmlFor="raceDate" error={fe.raceDate}><Input id="raceDate" name="raceDate" type="date" required invalid={!!fe.raceDate} /></Field>
        <Field label="Ubicación (opcional)" htmlFor="location"><Input id="location" name="location" maxLength={120} /></Field>
        <Field label="Tiempo objetivo (opcional)" htmlFor="targetTime" error={fe.targetTimeS} hint="Tu meta, no una predicción. h:mm:ss"><Input id="targetTime" name="targetTime" inputMode="numeric" invalid={!!fe.targetTimeS} /></Field>
      </div>
      {activePlanId ? (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="userPlanId" value={activePlanId} className="size-4 accent-navy" /> Asociar a mi plan activo</label>
      ) : null}
      <SubmitButton>Guardar competencia</SubmitButton>
    </form>
  );
}

export function ResultForm({ competitionId }: { competitionId: string }) {
  const [state, action] = useActionState(saveResultAction, initialActionState);
  const [splits, setSplits] = useState<number[]>([]);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="Tiempo final real" htmlFor={`ft-${competitionId}`} error={fe.finishTimeS} hint="h:mm:ss"><Input id={`ft-${competitionId}`} name="finishTime" inputMode="numeric" required /></Field>
      {splits.map((k, i) => (
        <div key={k} className="grid grid-cols-2 gap-2">
          <Field label={`Parcial ${i + 1} · km`} htmlFor={`sk-${k}`}><Input id={`sk-${k}`} name="splitKm" inputMode="decimal" defaultValue="5" /></Field>
          <Field label="Tiempo" htmlFor={`st-${k}`}><Input id={`st-${k}`} name="splitTime" inputMode="numeric" /></Field>
        </div>
      ))}
      {fe.splits ? <p className="text-xs text-danger">{fe.splits}</p> : null}
      <Button type="button" size="sm" variant="ghost" onClick={() => setSplits([...splits, Date.now()])}><Plus className="size-4" aria-hidden /> Agregar parcial</Button>
      <Field label="Comentarios" htmlFor={`n-${competitionId}`}><Textarea id={`n-${competitionId}`} name="notes" maxLength={500} className="min-h-16" /></Field>
      <SubmitButton size="sm">Guardar resultado</SubmitButton>
    </form>
  );
}
