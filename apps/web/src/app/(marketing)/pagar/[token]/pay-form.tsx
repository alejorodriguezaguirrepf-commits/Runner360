"use client";

import { useActionState, useEffect, useRef } from "react";
import { initialActionState } from "@/lib/action-state";
import { payFromEmailAction } from "@/lib/actions/email-pay";

/** Pasa solo a Mercado Pago al abrir el link; si no, el botón hace lo mismo. */
export function PayForm({ token, plan, label }: { token: string; plan: "mensual" | "anual"; label: string }) {
  const [state, action, pending] = useActionState(payFromEmailAction, initialActionState);
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    form.current?.requestSubmit();
  }, []);
  return (
    <form ref={form} action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="plan" value={plan} />
      <button disabled={pending} className="min-h-12 w-full rounded-xl bg-primary px-5 text-base font-bold text-on-primary disabled:opacity-60 sm:w-auto">
        {pending ? "Abriendo Mercado Pago…" : label}
      </button>
      {state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
