"use client";

import { useState } from "react";
import { CheckboxField, ChoiceGroup, FormMessage, SubmitButton, TextAreaField, TextField, useFormAction } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { logPlanSessionAction, type LogState } from "@/lib/actions/plan-progress";

const L = t.library.log;
const opts = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

export type LogDefaults = {
  status: "completed" | "modified" | "skipped";
  duration: string;
  distanceKm: string;
  rpe: string;
  pain: string;
  redFlags: string[];
  sleep: string;
  notes: string;
};

/** Registro post-sesión: RPE, dolor, señales de alarma, sueño, duración real y notas. */
export function SessionLogForm({ date, defaults, hasHealthConsent }: { date: string; defaults: LogDefaults; hasHealthConsent: boolean }) {
  const { state, pending, onSubmit } = useFormAction<LogState>(logPlanSessionAction, { ok: false });
  const [status, setStatus] = useState(defaults.status);
  const e = state.errors ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <input type="hidden" name="date" value={date} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">{L.status}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(L.statusOptions) as (keyof typeof L.statusOptions)[]).map((k) => (
            <label key={k} className="cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium has-[:checked]:border-primary-ink has-[:checked]:bg-accent has-[:checked]:text-on-accent has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-ink">
              <input type="radio" name="status" value={k} checked={status === k} onChange={() => setStatus(k)} className="sr-only" />
              {L.statusOptions[k]}
            </label>
          ))}
        </div>
      </fieldset>
      {status !== "skipped" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={L.duration} name="duration" placeholder="40:00" defaultValue={defaults.duration} error={e.duration} />
          <TextField label={L.distance} name="distanceKm" inputMode="decimal" defaultValue={defaults.distanceKm} error={e.distanceKm} />
          <TextField label={L.rpe} name="rpe" type="number" min={1} max={10} inputMode="numeric" defaultValue={defaults.rpe} error={e.rpe} />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={L.pain} name="pain" type="number" min={0} max={10} inputMode="numeric" defaultValue={defaults.pain} error={e.pain} />
        <ChoiceGroup legend={L.sleep} name="sleep" type="radio" options={opts(L.sleepOptions)} defaultValues={[defaults.sleep]} error={e.sleep} />
      </div>
      <ChoiceGroup legend={L.redFlags} name="redFlags" type="checkbox" options={opts(L.redFlagOptions)} defaultValues={defaults.redFlags} error={e.redFlags} />
      <TextAreaField label={L.notes} name="notes" maxLength={2000} defaultValue={defaults.notes} error={e.notes} />
      {hasHealthConsent ? null : <CheckboxField label={L.consent} name="healthConsent" error={e.healthConsent} />}
      {state.ruleTexts?.length ? (
        <Alert tone="warning" title={t.library.today.rulesTitle}>
          <ul className="list-disc pl-4">{state.ruleTexts.map((x) => <li key={x}>{x}</li>)}</ul>
        </Alert>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="…">{L.save}</SubmitButton>
    </form>
  );
}
