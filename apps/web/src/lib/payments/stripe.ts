import { serverEnv } from "@/lib/env.server";
import { verifyStripeSignature } from "./signatures";
import { ProviderNotConfiguredError, type NormalizedSubscriptionEvent, type PaymentProvider, type SubscriptionStatus, type WebhookInput } from "./types";

/**
 * Adaptador Stripe (proveedor internacional de suscripciones), vía API REST sin SDK.
 * NO PROBADO contra la cuenta real: requiere STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y
 * precios creados en Stripe (provider_price_id en product_prices).
 */

const API = "https://api.stripe.com/v1";

export function mapStripeStatus(s: string): SubscriptionStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    default:
      return "pending";
  }
}

interface StripeSubscriptionObject {
  id: string;
  status: string;
  cancel_at_period_end?: boolean;
  current_period_start?: number;
  current_period_end?: number;
  items?: { data?: { current_period_start?: number; current_period_end?: number }[] };
  metadata?: Record<string, string>;
}

const toIso = (s?: number) => (typeof s === "number" ? new Date(s * 1000).toISOString() : null);

/** Normaliza eventos `customer.subscription.*` (pura, testeable). */
export function normalizeStripeEvent(event: { id: string; type: string; data?: { object?: unknown } }): NormalizedSubscriptionEvent | null {
  if (!event.type.startsWith("customer.subscription.")) {
    return { providerEventId: event.id, eventType: event.type, providerSubscriptionId: null, userId: null, productCode: null, status: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: null };
  }
  const sub = event.data?.object as StripeSubscriptionObject | undefined;
  if (!sub?.id) return null;
  const item = sub.items?.data?.[0];
  return {
    providerEventId: event.id,
    eventType: event.type,
    providerSubscriptionId: sub.id,
    userId: sub.metadata?.user_id ?? null,
    productCode: sub.metadata?.product_code ?? null,
    status: event.type === "customer.subscription.deleted" ? "cancelled" : mapStripeStatus(sub.status),
    currentPeriodStart: toIso(sub.current_period_start ?? item?.current_period_start),
    currentPeriodEnd: toIso(sub.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? null,
  };
}

async function stripeRequest(path: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv.stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe ${res.status}`);
  return json;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Tarjeta internacional (Stripe)",
  isConfigured: () => Boolean(serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret),

  async createCheckout(req) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Stripe");
    if (!req.price.provider_price_id) throw new Error("El precio no tiene un identificador de Stripe configurado");
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": req.price.provider_price_id,
      "line_items[0][quantity]": "1",
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      client_reference_id: req.userId,
      customer_email: req.email,
      "subscription_data[metadata][user_id]": req.userId,
      "subscription_data[metadata][product_code]": req.product.code,
    });
    const session = await stripeRequest("/checkout/sessions", body);
    if (typeof session.url !== "string") throw new Error("Stripe no devolvió URL de checkout");
    return { url: session.url };
  },

  verifyWebhook({ rawBody, headers }: WebhookInput) {
    return verifyStripeSignature({ payload: rawBody, header: headers.get("stripe-signature"), secret: serverEnv.stripeWebhookSecret });
  },

  async parseWebhook({ rawBody }: WebhookInput) {
    return normalizeStripeEvent(JSON.parse(rawBody));
  },

  async cancelAtPeriodEnd(id) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Stripe");
    await stripeRequest(`/subscriptions/${encodeURIComponent(id)}`, new URLSearchParams({ cancel_at_period_end: "true" }));
  },
};
