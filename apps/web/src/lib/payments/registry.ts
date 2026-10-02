import { mercadoPagoProvider } from "./mercadopago";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, ProviderId } from "./types";

/** Proveedores web disponibles. Las tiendas móviles (Apple/Google) se validan por /api/v1/billing. */
export const PROVIDERS: Record<ProviderId, PaymentProvider> = {
  mercadopago: mercadoPagoProvider,
  stripe: stripeProvider,
};

export function getProvider(id: string): PaymentProvider | null {
  return id in PROVIDERS ? PROVIDERS[id as ProviderId] : null;
}
