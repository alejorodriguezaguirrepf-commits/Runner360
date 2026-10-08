"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
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
