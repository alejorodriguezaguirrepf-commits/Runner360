export type ProviderId = "mercadopago" | "stripe";
export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "canceled" | "expired";

export interface CheckoutInput {
  userId: string;
  email: string;
  productId: string;
  priceId: string;
  currency: string;
  amountMinor: number;
  interval: "month" | "year";
  providerPriceId: string | null;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}

/** Evento normalizado tras verificar firma y (si corresponde) consultar al proveedor. */
export interface NormalizedEvent {
  eventId: string;
  type: string;
  subscriptionRef: string | null;
  userId: string | null;
  productId: string | null;
  priceId: string | null;
  status: SubscriptionStatus | null;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  raw: unknown;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Monedas que el adaptador puede cobrar. */
  currencies: string[];
  isConfigured(): boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /** Verifica la firma y devuelve el evento normalizado, o null si la firma es inválida. */
  parseWebhook(req: { headers: Headers; rawBody: string; url: URL }): Promise<NormalizedEvent | null>;
  cancelAtPeriodEnd(subscriptionRef: string): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`El proveedor de pagos ${provider} está pendiente de configuración.`);
  }
}
