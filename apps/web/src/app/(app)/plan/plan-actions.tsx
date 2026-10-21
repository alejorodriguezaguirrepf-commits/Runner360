"use client";

import { useActionState } from "react";
import { CheckboxField, FormMessage, SubmitButton, useFormAction } from "@/components/ui/form";
import { ButtonLink, Card, CardTitle } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { t } from "@/i18n";
import { cancelEnrollmentAction, renewEnrollmentAction } from "@/lib/actions/enrollment";
import { cancelPlanAction, enrollAction } from "@/lib/actions/plan";

export function EnrollButton({ label, versionId, variant = "primary", confirmText }: { label: string; versionId?: string; variant?: "primary" | "ghost"; confirmText?: string }) {
  const [state, action] = useActionState(enrollAction, initialActionState);
  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="versionId" value={versionId ?? ""} />
      <SubmitButton variant={variant} pendingText="Armando calendario…">{label}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function CancelPlanButton() {
  return (
    <form
      action={cancelPlanAction}
      onSubmit={(e) => {
        if (!window.confirm("¿Querés abandonar este plan? Tu historial de entrenamientos se conserva.")) e.preventDefault();
      }}
    >
      <SubmitButton variant="ghost" pendingText="Cerrando…">Abandonar plan</SubmitButton>
    </form>
  );
}

export function CancelEnrollmentButton() {
  const c = t.library.calendar;
  return (
    <form
      action={cancelEnrollmentAction}
      onSubmit={(e) => {
        if (!window.confirm(c.cancelConfirm)) e.preventDefault();
      }}
    >
      <SubmitButton variant="ghost" pendingText={c.cancelPending}>{c.cancel}</SubmitButton>
    </form>
  );
}

/** Plan terminado: renovarlo (mismo plan, desde el próximo lunes) o elegir otro. */
export function PlanFinishedCard({ enrollmentId, planTitle, annual }: { enrollmentId: string; planTitle: string; annual: boolean }) {
  const f = t.library.finished;
  const { state, pending, onSubmit } = useFormAction(renewEnrollmentAction, { ok: false });
  return (
    <Card className="mb-6 border-primary">
      <CardTitle>{f.title}</CardTitle>
      <p className="mb-4 text-sm text-muted">{annual ? f.annualText.replace("{plan}", planTitle) : f.text.replace("{plan}", planTitle)}</p>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <input type="hidden" name="enrollment" value={enrollmentId} />
        <CheckboxField name="safety" label={t.library.enroll.safety} error={state.errors?.safety} />
        {state.ok ? null : <FormMessage state={state} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <SubmitButton pending={pending} pendingText={f.renewing}>{f.renew}</SubmitButton>
          <ButtonLink href="/planes" variant="secondary">{f.choose}</ButtonLink>
        </div>
      </form>
    </Card>
  );
}
