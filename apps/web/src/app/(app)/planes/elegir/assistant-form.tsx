"use client";

import type { CheckStatus, RequirementCheck } from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import Link from "next/link";
import { useState } from "react";
import { CheckboxField, ChoiceGroup, FormMessage, SelectField, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { IconAlert, IconCheck, IconInfo } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { assessAction, type AssistantState } from "@/lib/actions/library";

const m = t.library.assistant;

export interface AssistantDefaults {
  distanceKm: string;
  runningMonths: string;
  weeklyKm: string;
  currentDays: string;
  daysAvailable: string;
  markDistanceKm: string;
  markTime: string;
  markDate: string;
  raceDate: string;
}

const STATUS: Record<CheckStatus, { label: string; tone: "success" | "danger" | "warning"; text: string; Icon: typeof IconCheck }> = {
  met: { label: m.met, tone: "success", text: "text-success", Icon: IconCheck },
  unmet: { label: m.unmet, tone: "danger", text: "text-danger", Icon: IconAlert },
  pending: { label: m.pending, tone: "warning", text: "text-warning", Icon: IconInfo },
};

function Checks({ checks }: { checks: RequirementCheck[] }) {
  // Un texto del contenido puede originar más de un control: se muestra una vez, con el peor estado.
  const byText = new Map<string, CheckStatus>();
  const rank: Record<CheckStatus, number> = { met: 0, pending: 1, unmet: 2 };
  for (const c of checks) {
    const prev = byText.get(c.requirement.text);
    if (!prev || rank[c.status] > rank[prev]) byText.set(c.requirement.text, c.status);
  }
  return (
    <ul className="space-y-2 text-sm">
      {[...byText.entries()].map(([text, status]) => {
        const s = STATUS[status];
        return (
          <li key={text} className="flex items-start gap-2">
            <s.Icon className={`mt-0.5 shrink-0 ${s.text}`} width={16} height={16} />
            <span className="flex-1">{text}</span>
            <Badge tone={s.tone}>{s.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

function Result({ result }: { result: NonNullable<AssistantState["result"]> }) {
  const { recommendation: r, focus } = result;
  return (
    <section aria-live="polite" aria-labelledby="resultado" className="space-y-4">
      <h2 id="resultado" className="text-lg font-bold">{m.resultTitle}</h2>
      {focus ? (
        <Card>
          <CardTitle action={<Badge tone={focus.eligible && (!focus.timing || focus.timing.ok) ? "success" : "danger"}>{focus.eligible ? m.eligible : m.notEligible}</Badge>}>
            {focus.plan.title}
          </CardTitle>
          <Checks checks={focus.checks} />
          {focus.timing && !focus.timing.ok ? (
            <p className="mt-3 text-sm text-warning">{m.blocked.race_too_soon} {fmt(m.alternativeRace, { date: formatDate(focus.timing.earliestRaceDate, "long") })}</p>
          ) : null}
        </Card>
      ) : null}

      {r.kind === "recommended" ? (
        <Card tone="dark">
          <p className="text-sm font-semibold uppercase tracking-wide text-lime-400">{m.recommended}</p>
          <p className="mt-1 text-xl font-bold">{r.plan.title}</p>
          <p className="mt-1 text-sm text-white/80">{fmt(m.startsOn, { start: formatDate(r.startDate, "long"), race: formatDate(r.raceDate, "long") })}</p>
          <div className="mt-4 rounded-xl bg-white p-4 text-ink">
            <h3 className="mb-2 text-sm font-semibold">{m.whyTitle}</h3>
            <Checks checks={r.checks} />
            {r.checks.some((c) => c.status === "pending") ? <p className="mt-3 text-xs text-muted">{m.pendingMark}</p> : null}
          </div>
          <div className="mt-4">
            <ButtonLink href={`/planes/${r.plan.id}`}>{m.viewPlan}</ButtonLink>
          </div>
        </Card>
      ) : (
        <Card className="space-y-3">
          <Alert tone="warning">{m.blocked[r.reason]}</Alert>
          {r.contentNotes.length ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold">{m.contentSays}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">{r.contentNotes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          ) : null}
          {r.alternative ? (
            <div className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold">{fmt(m.alternative, { title: r.alternative.plan.title })}</p>
              <p className="text-muted">{fmt(m.alternativeRace, { date: formatDate(r.alternative.earliestRaceDate, "long") })}</p>
              <Link href={`/planes/${r.alternative.plan.id}`} className="mt-2 inline-block font-semibold underline">{m.viewPlan}</Link>
            </div>
          ) : null}
          {r.assessed.length ? (
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer content-center font-semibold">{m.otherPlans}</summary>
              <ul className="mt-2 space-y-3">
                {r.assessed.map((a) => (
                  <li key={a.plan.id} className="rounded-xl border border-line p-3">
                    <p className="mb-2 flex flex-wrap items-center gap-2 font-semibold">
                      <Link href={`/planes/${a.plan.id}`} className="underline">{a.plan.title}</Link>
                      <Badge tone={a.eligible ? "success" : "danger"}>{a.eligible ? m.eligible : m.notEligible}</Badge>
                    </p>
                    <Checks checks={a.checks} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      )}
    </section>
  );
}

export function AssistantForm({
  defaults,
  distances,
  focusPlanId,
  prefilled,
}: {
  defaults: AssistantDefaults;
  distances: { value: string; label: string }[];
  focusPlanId: string | null;
  prefilled: boolean;
}) {
  const { state, pending, onSubmit } = useFormAction<AssistantState>(assessAction, { ok: false });
  const [healthFlag, setHealthFlag] = useState(false);
  const e = state.errors ?? {};
  const opts = (rec: Record<string, string>) => Object.entries(rec).map(([value, label]) => ({ value, label }));

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {focusPlanId ? <input type="hidden" name="plan" value={focusPlanId} /> : null}
        {prefilled ? <Alert tone="info">{m.prefilled}</Alert> : null}

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.goal}</h2>
          <ChoiceGroup legend={m.distance} name="distanceKm" type="radio" options={distances} defaultValues={[defaults.distanceKm]} error={e.distanceKm} />
          <TextField label={m.daysAvailable} name="daysAvailable" type="number" inputMode="numeric" min={1} max={7} defaultValue={defaults.daysAvailable} error={e.daysAvailable} />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.base}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={m.runningSince} name="runningMonths" defaultValue={defaults.runningMonths} options={opts(m.runningSinceOptions)} error={e.runningMonths} />
            <TextField label={m.weeklyKm} name="weeklyKm" inputMode="decimal" defaultValue={defaults.weeklyKm} error={e.weeklyKm} />
            <TextField label={m.currentDays} name="currentDays" type="number" inputMode="numeric" min={0} max={7} defaultValue={defaults.currentDays} error={e.currentDays} />
            <TextField label={m.continuousMinutes} name="continuousMinutes" type="number" inputMode="numeric" min={0} max={600} defaultValue="0" error={e.continuousMinutes} />
            <TextField label={m.longRunKm} name="longRunKm" inputMode="decimal" defaultValue="0" error={e.longRunKm} />
          </div>
          <CheckboxField label={m.briskWalk} name="canBriskWalk" defaultChecked />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.experience}</h2>
          <ChoiceGroup legend={m.paceExperience} name="paceExperience" type="radio" options={opts(m.paceOptions)} defaultValues={["none"]} error={e.paceExperience} />
          <CheckboxField label={m.halfMarathon} name="completedHalfMarathon" />
          <CheckboxField label={m.marathon} name="completedMarathon" />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.health}</h2>
          <CheckboxField label={m.activeInjury} name="activeInjury" />
          <CheckboxField label={m.overuseHistory} name="overuseInjuryHistory" />
          <CheckboxField label={m.healthFlag} name="healthFlag" checked={healthFlag} onChange={(ev) => setHealthFlag(ev.target.checked)} />
          {healthFlag ? <CheckboxField label={m.medicalClearance} name="medicalClearance" /> : null}
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.mark}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label={m.markDistance} name="markDistanceKm" defaultValue={defaults.markDistanceKm} placeholder={m.markNone} options={[
              { value: "5", label: "5 km" },
              { value: "10", label: "10 km" },
              { value: "21.1", label: "21,1 km" },
              { value: "42.195", label: "42,195 km" },
            ]} error={e.markDistanceKm} />
            <TextField label={m.markTime} name="markTime" placeholder="25:30" defaultValue={defaults.markTime} error={e.markTime} />
            <TextField label={m.markDate} name="markDate" type="date" defaultValue={defaults.markDate} error={e.markDate} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">{m.sections.race}</h2>
          <TextField label={m.raceDate} name="raceDate" type="date" defaultValue={defaults.raceDate} error={e.raceDate} />
        </Card>

        {state.ok ? null : <FormMessage state={state} />}
        <SubmitButton pending={pending} pendingText="…">{m.submit}</SubmitButton>
      </form>
      {state.ok && state.result ? <Result result={state.result} /> : null}
    </div>
  );
}
