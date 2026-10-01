"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { BEVERAGE_LABELS, BEVERAGE_TYPES, HYDRATION_CONTEXT_LABELS, HYDRATION_CONTEXTS, WEEKDAY_SHORT, WEEKDAYS } from "@runner360/shared";
import { addHydrationAction, addReminderAction } from "@/app/app/hidratacion/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/form";

function nowLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function HydrationForm() {
  const [state, action] = useActionState(addHydrationAction, initialActionState);
  const [beverage, setBeverage] = useState("water");
  const [loggedAt, setLoggedAt] = useState("");
  const [tz, setTz] = useState("180");
  const volRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setLoggedAt(nowLocal());
    setTz(String(new Date().getTimezoneOffset()));
  }, [state]);
  const fe = state.fieldErrors ?? {};
  const isGel = beverage === "gel";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tzOffset" value={tz} />
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bebida o suplemento" htmlFor="beverageType">
          <Select id="beverageType" name="beverageType" value={beverage} onChange={(e) => setBeverage(e.target.value)}>
            {BEVERAGE_TYPES.map((b) => <option key={b} value={b}>{BEVERAGE_LABELS[b]}</option>)}
          </Select>
        </Field>
        <Field label="Momento" htmlFor="context">
          <Select id="context" name="context" defaultValue="daily">
            {HYDRATION_CONTEXTS.map((c) => <option key={c} value={c}>{HYDRATION_CONTEXT_LABELS[c]}</option>)}
          </Select>
        </Field>
        {isGel ? (
          <Field label="Unidades" htmlFor="units" error={fe.units}>
            <Input id="units" name="units" type="number" min={1} max={20} defaultValue={1} />
          </Field>
        ) : (
          <Field label="Cantidad (ml)" htmlFor="volumeMl" error={fe.volumeMl}>
            <Input ref={volRef} id="volumeMl" name="volumeMl" type="number" min={1} max={5000} inputMode="numeric" required invalid={!!fe.volumeMl} />
            <div className="mt-2 flex gap-2">
              {[250, 500, 750].map((ml) => (
                <Button key={ml} type="button" size="sm" variant="secondary" onClick={() => { if (volRef.current) volRef.current.value = String(ml); }}>{ml} ml</Button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Fecha y hora" htmlFor="loggedAt" error={fe.loggedAt}>
          <Input id="loggedAt" name="loggedAt" type="datetime-local" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} required />
        </Field>
      </div>
      <SubmitButton>Registrar</SubmitButton>
    </form>
  );
}

export function ReminderForm() {
  const [state, action] = useActionState(addReminderAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="label" error={fe.label}><Input id="label" name="label" defaultValue="Tomar agua" maxLength={60} /></Field>
        <Field label="Hora" htmlFor="timeOfDay" error={fe.timeOfDay}><Input id="timeOfDay" name="timeOfDay" type="time" defaultValue="10:00" required /></Field>
      </div>
      <div role="group" aria-label="Días" className="flex flex-wrap gap-2">
        {WEEKDAYS.map((d) => (
          <label key={d} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white">
            <input type="checkbox" name="weekdays" value={d} defaultChecked className="size-4 accent-lime" /> {WEEKDAY_SHORT[d]}
          </label>
        ))}
      </div>
      {fe.weekdays ? <p className="text-xs text-danger">{fe.weekdays}</p> : null}
      <SubmitButton variant="secondary">Agregar recordatorio</SubmitButton>
    </form>
  );
}
