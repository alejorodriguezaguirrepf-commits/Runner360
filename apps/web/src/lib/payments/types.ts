import type { PriceRow, ProductRow } from "@runner360/shared";

export type ProviderId = "mercadopago" | "stripe";
export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled" | "expired";

export interface CheckoutRequest {
  userId: string;
  email: string;
  product: ProductRow;
  price: PriceRow;
  successUrl: string;
  cancelUrl: string;
}

/** Evento de suscripción normalizado, independiente del proveedor. */
export interface NormalizedSubscriptionEvent {
  providerEventId: string;
  eventType: string;
  providerSubscriptionId: string | null;
  userId: string | null;
  productCode: string | null;
  status: SubscriptionStatus | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  /** Débito automático informado en este evento (libera un mes del plan si está aprobado). */
  payment?: NormalizedPayment | null;
  /** Pago único (plan anual): el período lo calcula el servidor al aprobarse el pago. */
  prepaid?: boolean;
}

export type PaymentStatus = "approved" | "pending" | "rejected" | "refunded";

export interface NormalizedPayment {
  providerPaymentId: string;
  status: PaymentStatus;
  amountMinor: number | null;
  currency: string | null;
  paidAt: string;
}

export interface WebhookInput {
  rawBody: string;
  headers: Headers;
  url: URL;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly label: string;
  /** true solo si existen todas las credenciales necesarias. */
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<{ url: string }>;
  /** Verifica la firma del webhook. Nunca procesar eventos con firma inválida. */
  verifyWebhook(input: WebhookInput): boolean;
  /** Normaliza el evento (puede consultar la API del proveedor para obtener el estado real). */
  parseWebhook(input: WebhookInput): Promise<NormalizedSubscriptionEvent | null>;
  cancelAtPeriodEnd(providerSubscriptionId: string): Promise<void>;
  /**
   * Estado real de la operación con la que la persona vuelve del checkout (parámetros de la URL de
   * vuelta). Opcional: permite activar el acceso sin esperar el webhook.
   */
  eventFromReturn?(params: URLSearchParams): Promise<NormalizedSubscriptionEvent | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`El proveedor de pagos ${provider} está pendiente de configuración.`);
  }
}
