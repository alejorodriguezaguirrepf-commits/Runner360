import "server-only";
import { hmacSha256Hex, parseSignatureHeader, safeEqualHex } from "./crypto";
import { ProviderNotConfiguredError, type NormalizedEvent, type PaymentProvider, type SubscriptionStatus } from "./types";

/**
 * Adaptador Stripe (suscripciones internacionales). Implementado con la API HTTP para no agregar dependencias.
 * Estado: NO probado contra la API real (requiere STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET).
 */
const API = "https://api.stripe.com/v1";
const TOLERANCE_S = 300;

export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowS = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = parseSignatureHeader(header);
  const t = parts.get("t")?.[0];
  const sigs = parts.get("v1") ?? [];
  if (!t || !/^\d+$/.test(t) || sigs.length === 0) return false;
  if (Math.abs(nowS - Number(t)) > TOLERANCE_S) return false;
  const expected = hmacSha256Hex(secret, `${t}.${rawBody}`);
  return sigs.some((s) => safeEqualHex(s, expected));
}

export function mapStripeStatus(s: string | undefined): SubscriptionStatus | null {
  switch (s) {
    case "active": return "active";
    case "trialing": return "trialing";
    case "past_due":
    case "unpaid": return "past_due";
    case "canceled": return "canceled";
    case "incomplete": return "pending";
    case "incomplete_expired": return "expired";
    case "paused": return "past_due";
    default: return null;
  }
}

const toIso = (s: unknown) => (typeof s === "number" ? new Date(s * 1000).toISOString() : null);

type StripeObj = Record<string, unknown> & { metadata?: Record<string, string> };

export function normalizeStripeEvent(event: { id: string; type: string; data: { object: StripeObj } }): NormalizedEvent {
  const o = event.data.object;
  const md = o.metadata ?? {};
  const base: NormalizedEvent = {
    eventId: event.id,
    type: event.type,
    subscriptionRef: null,
    userId: md.user_id ?? null,
    productId: md.product_id ?? null,
    priceId: md.price_id ?? null,
    status: null,
    periodStart: null,
    periodEnd: null,
    cancelAtPeriodEnd: null,
    raw: event,
  };
  if (event.type === "checkout.session.completed") {
    return { ...base, subscriptionRef: (o.subscription as string) ?? null, userId: (o.client_reference_id as string) ?? base.userId, status: "active" };
  }
  if (event.type.startsWith("customer.subscription.")) {
    // En versiones recientes de la API el período vive en los ítems de la suscripción.
    const item = ((o.items as { data?: StripeObj[] } | undefined)?.data ?? [])[0];
    return {
      ...base,
      subscriptionRef: o.id as string,
      status: event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(o.status as string),
      periodStart: toIso(o.current_period_start ?? item?.current_period_start),
      periodEnd: toIso(o.current_period_end ?? item?.current_period_end),
      cancelAtPeriodEnd: Boolean(o.cancel_at_period_end),
    };
  }
  return base;
}

async function stripeFetch(path: string, body: URLSearchParams, key: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`stripe_http_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  label: "Tarjeta internacional (Stripe)",
  currencies: ["USD"],
  isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  async createCheckout(input) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new ProviderNotConfiguredError("Stripe");
    if (!input.providerPriceId) throw new ProviderNotConfiguredError("Stripe (falta el price id del producto)");
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": input.providerPriceId,
      "line_items[0][quantity]": "1",
      client_reference_id: input.userId,
      customer_email: input.email,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "subscription_data[metadata][user_id]": input.userId,
      "subscription_data[metadata][product_id]": input.productId,
      "subscription_data[metadata][price_id]": input.priceId,
      "metadata[user_id]": input.userId,
      "metadata[product_id]": input.productId,
      "metadata[price_id]": input.priceId,
    });
    const session = await stripeFetch("/checkout/sessions", body, key);
    return { url: String(session.url) };
  },
  async parseWebhook({ headers, rawBody }) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new ProviderNotConfiguredError("Stripe");
    if (!verifyStripeSignature(rawBody, headers.get("stripe-signature"), secret)) return null;
    return normalizeStripeEvent(JSON.parse(rawBody));
  },
  async cancelAtPeriodEnd(ref) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new ProviderNotConfiguredError("Stripe");
    await stripeFetch(`/subscriptions/${encodeURIComponent(ref)}`, new URLSearchParams({ cancel_at_period_end: "true" }), key);
  },
};
