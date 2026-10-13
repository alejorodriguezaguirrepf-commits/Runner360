"use client";

import { DAY_LABELS, dayMapViolations, type DayShape } from "@runner360/plan-library";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/ui/form";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { moveDaysAction, type MoveDaysState } from "@/lib/actions/enrollment";

const m = t.library.moveDays;

export type PlanDayInfo = { dayIndex: number; label: string; demanding: boolean };

export function MoveDaysForm({ initial, days, shapes }: { initial: number[]; days: PlanDayInfo[]; shapes: DayShape[] }) {
  const { state, pending, onSubmit } = useFormAction<MoveDaysState>(moveDaysAction, { ok: false });
  const [map, setMap] = useState<number[]>(initial);
  // Vista previa inmediata sobre las semanas visibles; el servidor controla TODAS las semanas.
  const preview = dayMapViolations(shapes, map);
  const shown = state.violations?.length ? state.violations : preview;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3">{m.planDay}</th>
              <th scope="col" className="py-2">{m.weekday}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d) => (
              <tr key={d.dayIndex}>
                <th scope="row" className="py-2 pr-3 font-semibold">
                  {DAY_LABELS[d.dayIndex]} · <span className="font-normal">{d.label}</span>
                  {d.demanding ? <Badge tone="warning" className="ml-2">{m.demanding}</Badge> : null}
                </th>
                <td className="py-2">
                  <label className="sr-only" htmlFor={`d${d.dayIndex}`}>{`${m.weekday} (${DAY_LABELS[d.dayIndex]})`}</label>
                  <select
                    id={`d${d.dayIndex}`}
                    name={`d${d.dayIndex}`}
                    value={map[d.dayIndex]}
                    onChange={(e) => setMap((prev) => prev.map((v, i) => (i === d.dayIndex ? Number(e.target.value) : v)))}
                    className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm"
                  >
                    {DAY_LABELS.map((label, w) => (
                      <option key={label} value={w}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{m.note}</p>
      </Card>
      {shown.length ? (
        <Alert tone="danger">
          <ul className="list-disc pl-4">{shown.map((v) => <li key={v}>{m.violations[v]}</li>)}</ul>
        </Alert>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText="…">{m.save}</SubmitButton>
    </form>
  );
}
