"use client";

import { BEVERAGE_LABELS, HYDRATION_CONTEXT_LABELS, WEEKDAY_SHORT } from "@runner360/shared";
import { useActionState, useState } from "react";
import { ChoiceGroup, FormMessage, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { addHydrationAction, addReminderAction } from "@/lib/actions/modules";

export function HydrationForm({ today }: { today: string }) {
  const [state, action] = useActionState(addHydrationAction, initialActionState);
  const [beverage, setBeverage] = useState("water");
  const [volume, setVolume] = useState("250");
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="logDate" value={today} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cantidades rápidas">
        {[150, 250, 500, 750].map((ml) => (
          <button key={ml} type="button" onClick={() => setVolume(String(ml))} aria-pressed={volume === String(ml)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold aria-pressed:border-navy-900 aria-pressed:bg-navy-900 aria-pressed:text-white">
            {ml} ml
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Bebida" name="beverage" value={beverage} onChange={(e) => setBeverage(e.target.value)} options={Object.entries(BEVERAGE_LABELS).map(([value, label]) => ({ value, label }))} />
        <TextField label="Cantidad (ml)" name="volumeMl" type="number" min={0} max={5000} inputMode="numeric" value={volume} onChange={(e) => setVolume(e.target.value)} error={state.errors?.volumeMl} />
        <SelectField label="Momento" name="context" options={Object.entries(HYDRATION_CONTEXT_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      {beverage === "gel" || beverage === "sports_drink" ? (
        <TextField label="Carbohidratos (g, opcional)" name="carbsG" type="number" min={0} max={200} inputMode="numeric" error={state.errors?.carbsG} hint="Según la etiqueta del producto." />
      ) : null}
      <FormMessage state={state} />
      <SubmitButton>Agregar</SubmitButton>
    </form>
  );
}

export function ReminderForm() {
  const [state, action] = useActionState(addReminderAction, initialActionState);
  return (
    <form action={action} className="space-y-3 border-t border-line pt-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Etiqueta" name="label" defaultValue="Tomar agua" maxLength={60} error={state.errors?.label} />
        <TextField label="Hora" name="timeOfDay" type="time" defaultValue="10:00" error={state.errors?.timeOfDay} />
      </div>
      <ChoiceGroup legend="Días" name="weekdays" type="checkbox" options={WEEKDAY_SHORT.map((l, i) => ({ value: String(i + 1), label: l }))} defaultValues={["1", "2", "3", "4", "5", "6", "7"]} error={state.errors?.weekdays} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Guardar recordatorio</SubmitButton>
    </form>
  );
}
