import "server-only";
import { mercadoPagoProvider } from "./mercadopago";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  mercadopago: mercadoPagoProvider,
  stripe: stripeProvider,
};

export function getProvider(id: string): PaymentProvider | null {
  return id === "mercadopago" || id === "stripe" ? PROVIDERS[id] : null;
}
