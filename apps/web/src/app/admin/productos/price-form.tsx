"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { addPriceAction } from "@/lib/actions/admin";

export function PriceForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(addPriceAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="productId" value={productId} />
      <TextField label="Moneda" name="currency" defaultValue="USD" maxLength={3} error={e.currency} />
      <TextField label="Importe" name="amount" placeholder="7,99" inputMode="decimal" error={e.amount} />
      <SelectField label="Proveedor" name="provider" placeholder="Precio de lista" options={[{ value: "mercadopago", label: "Mercado Pago" }, { value: "stripe", label: "Stripe" }, { value: "apple", label: "App Store" }, { value: "google", label: "Google Play" }]} />
      <TextField label="ID en proveedor" name="providerPriceId" placeholder="opcional" error={e.providerPriceId} />
      <SubmitButton variant="secondary">Guardar precio</SubmitButton>
      <div className="sm:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}
