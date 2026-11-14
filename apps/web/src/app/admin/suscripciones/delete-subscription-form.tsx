"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { deleteSubscriptionAction } from "@/lib/actions/admin";

/** Borrar una suscripción que no está activa (sus débitos quedan guardados). */
export function DeleteSubscriptionForm({ subscriptionId, email }: { subscriptionId: string; email: string }) {
  const [state, action, pending] = useActionState(deleteSubscriptionAction, initialActionState);
  if (state.ok) return <p className="mt-3 text-sm font-semibold text-success" role="status">{state.message}</p>;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`¿Borrar la suscripción inactiva de ${email}? Sus débitos quedan guardados. No se puede deshacer.`)) e.preventDefault();
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <button disabled={pending} className="min-h-11 rounded-xl border border-danger/50 px-3 text-sm font-semibold text-danger hover:bg-danger-bg disabled:opacity-50">
        {pending ? "Borrando…" : "Eliminar suscripción"}
      </button>
      {state.message ? <span className="text-sm text-danger" role="alert">{state.message}</span> : null}
    </form>
  );
}
