"use client";

import { formatDate } from "@runner360/shared";
import { useState } from "react";
import { CheckboxField, FormMessage, SelectField, SubmitButton, useFormAction } from "@/components/ui/form";
import { Card, CardTitle } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { enrollLibraryPlanAction } from "@/lib/actions/enrollment";

const em = t.library.enroll;

/** Inscripción directa: lunes de inicio + confirmación de los avisos de seguridad. */
export function EnrollForm({
  planId,
  starts,
  raceWeek,
  premium,
  hasDemoPlan,
}: {
  planId: string;
  starts: { start: string; race: string }[];
  raceWeek: number;
  premium: boolean;
  hasDemoPlan: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction(enrollLibraryPlanAction, { ok: false });
  const [start, setStart] = useState(starts[0]?.start ?? "");
  const race = starts.find((s) => s.start === start)?.race;
  return (
    <Card>
      <CardTitle>{em.title}</CardTitle>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" name="plan" value={planId} />
        <SelectField
          label={em.startLabel}
          name="startDate"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          options={starts.map((s) => ({ value: s.start, label: formatDate(s.start, "long") }))}
          hint={fmt(em.startHint, { n: raceWeek })}
          error={state.errors?.startDate}
        />
        {race ? <p className="text-sm font-semibold">{fmt(em.raceOn, { date: formatDate(race, "long") })}</p> : null}
        <CheckboxField name="safety" label={em.safety} error={state.errors?.safety} />
        <p className="text-xs text-muted">{premium ? em.paidNote : em.freeNote}</p>
        {hasDemoPlan ? <p className="text-xs text-warning">{em.demoWarning}</p> : null}
        {state.ok ? null : <FormMessage state={state} />}
        <SubmitButton pending={pending} pendingText={em.pending}>{premium ? em.submit : em.submitFree}</SubmitButton>
      </form>
    </Card>
  );
}
