"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { sendCampaignsNowAction } from "@/lib/actions/notifications";

/** Botón para mandar ahora los correos que tocan hoy (lo mismo que la tarea diaria). */
export function SendCampaignsForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(sendCampaignsNowAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <button
        disabled={disabled || pending}
        className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-50"
      >
        {pending ? "Enviando…" : "Enviar ahora los correos de hoy"}
      </button>
      {state.message ? (
        <p role="status" className={state.ok ? "text-sm text-success" : "text-sm text-danger"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
