"use client";

import { allowedDecisions, type LoadDecision } from "@runner360/plan-library";
import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { checkinAction } from "@/lib/actions/plan-progress";

const C = t.library.checkin;

export type CheckinOption = { recommendation: LoadDecision; regressTo: number | null; texts: string[] };

/**
 * Check-in semanal: se muestra el criterio de progresión; según la respuesta, la recomendación del
 * motor (con los textos del contenido que la respaldan) y las decisiones posibles. El servidor
 * vuelve a calcular la recomendación antes de guardar.
 */
export function CheckinCard({
  weekStart,
  title,
  criterion,
  ifYes,
  ifNo,
  returnTo,
}: {
  returnTo: "/hoy" | "/plan";
  weekStart: string;
  title: string;
  criterion: string;
  ifYes: CheckinOption;
  ifNo: CheckinOption;
}) {
  const { state, pending, onSubmit } = useFormAction(checkinAction, { ok: false });
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const option = answer === "yes" ? ifYes : answer === "no" ? ifNo : null;
  const decisions = option ? allowedDecisions(option.recommendation) : [];
  const label = (d: LoadDecision) => fmt(C.decisions[d], { n: option?.regressTo ?? 1 });

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-base font-bold">{C.title}</h2>
        <p className="text-sm text-muted">{title}</p>
      </div>
      <div className="rounded-xl bg-canvas p-3 text-sm">
        <p className="font-semibold">{C.criterion}</p>
        <p>{criterion}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" name="weekStart" value={weekStart} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">{C.question}</legend>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-semibold has-[:checked]:border-lime-400 has-[:checked]:bg-lime-400 has-[:checked]:text-navy-950 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-lime-400">
                <input type="radio" name="criterion" value={v} checked={answer === v} onChange={() => setAnswer(v)} className="sr-only" />
                {v === "yes" ? C.yes : C.no}
              </label>
            ))}
          </div>
        </fieldset>
        {option ? (
          <>
            <Alert tone={option.recommendation === "pause" ? "danger" : option.recommendation === "advance" ? "success" : "warning"} title={C.recommendation}>
              <p>{fmt(C.recs[option.recommendation], { n: option.regressTo ?? 1 })}</p>
              {option.texts.length ? (
                <div className="mt-2">
                  <p className="font-semibold">{C.because}</p>
                  <ul className="list-disc pl-4">{option.texts.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              ) : null}
            </Alert>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{C.decide}</legend>
              <div className="flex flex-wrap gap-2">
                {decisions.map((d, i) => (
                  <label key={d} className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-semibold has-[:checked]:border-lime-400 has-[:checked]:bg-lime-400 has-[:checked]:text-navy-950 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-lime-400">
                    <input type="radio" name="decision" value={d} defaultChecked={i === 0} className="sr-only" />
                    {label(d)}
                  </label>
                ))}
              </div>
              {decisions.includes("reduce") ? <p className="text-xs text-muted">{C.reduceNote}</p> : null}
            </fieldset>
            <FormMessage state={state} />
            <SubmitButton pending={pending} pendingText="…">{C.confirm}</SubmitButton>
          </>
        ) : null}
      </form>
    </Card>
  );
}
