"use client";

import { DISTANCE_LABELS, LEVEL_LABELS } from "@runner360/shared";
import { useActionState } from "react";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { createPlanAction } from "@/lib/actions/admin";

export function NewPlanForm() {
  const [state, action] = useActionState(createPlanAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <TextField label="Nombre" name="name" error={e.name} />
      <TextField label="Identificador (slug)" name="slug" placeholder="10k-intermedio" error={e.slug} />
      <SelectField label="Distancia" name="distance" options={Object.entries(DISTANCE_LABELS).map(([value, label]) => ({ value, label }))} />
      <SelectField label="Nivel" name="level" options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
      <TextField label="Semanas (8–24)" name="durationWeeks" type="number" min={8} max={24} defaultValue={12} error={e.durationWeeks} />
      <TextField label="Sesiones por semana" name="sessionsPerWeek" type="number" min={1} max={7} defaultValue={3} error={e.sessionsPerWeek} />
      <div className="sm:col-span-3"><CheckboxField name="isPremium" label="Incluido solo en Premium" defaultChecked /></div>
      <div className="sm:col-span-3"><FormMessage state={state} /><SubmitButton variant="secondary">Crear plan (borrador)</SubmitButton></div>
    </form>
  );
}
