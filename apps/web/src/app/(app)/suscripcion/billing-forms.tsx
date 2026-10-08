"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { cancelSubscriptionAction, startCheckoutAction } from "@/lib/actions/billing";

export function CheckoutForm({ productId, providers }: { productId: string; providers: { id: string; label: string; configured: boolean }[] }) {
  const [state, action] = useActionState(startCheckoutAction, initialActionState);
  const available = providers.filter((p) => p.configured);
  if (available.length === 0) return <p className="text-sm text-muted">Medios de pago pendientes de configuración para este producto.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {available.map((p) => (
          <form key={p.id} action={action}>
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="provider" value={p.id} />
            <SubmitButton pendingText="Redirigiendo…">{`Pagar con ${p.label}`}</SubmitButton>
          </form>
        ))}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

export function CancelSubscriptionForm() {
  const [state, action] = useActionState(cancelSubscriptionAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton variant="ghost" pendingText="Cancelando…">Cancelar renovación</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
