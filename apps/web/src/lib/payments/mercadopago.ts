import "server-only";
import { hmacSha256Hex, parseSignatureHeader, safeEqualHex } from "./crypto";
import { ProviderNotConfiguredError, type NormalizedEvent, type PaymentProvider, type SubscriptionStatus } from "./types";

/**
 * Adaptador Mercado Pago (suscripciones con "preapproval"). Implementado con la API HTTP.
 * Estado: NO probado contra la API real (requiere MERCADOPAGO_ACCESS_TOKEN y MERCADOPAGO_WEBHOOK_SECRET).
 * external_reference = "<user_id>:<price_id>" para vincular la suscripción con el usuario y el precio.
 */
const API = "https://api.mercadopago.com";

/** Firma x-signature: HMAC-SHA256 del manifiesto "id:<data.id>;request-id:<x-request-id>;ts:<ts>;". */
export function verifyMercadoPagoSignature(params: { xSignature: string | null; xRequestId: string | null; dataId: string | null; secret: string }): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature) return false;
  const parts = parseSignatureHeader(xSignature);
  const ts = parts.get("ts")?.[0];
  const v1 = parts.get("v1")?.[0];
  if (!ts || !v1) return false;
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  return safeEqualHex(v1, hmacSha256Hex(secret, manifest));
}

export function mapMercadoPagoStatus(s: string | undefined): SubscriptionStatus | null {
  switch (s) {
    case "authorized": return "active";
    case "pending": return "pending";
    case "paused": return "past_due";
    case "cancelled": return "canceled";
    default: return null;
  }
}

export function parseExternalReference(ref: unknown): { userId: string | null; priceId: string | null } {
  if (typeof ref !== "string") return { userId: null, priceId: null };
  const [userId, priceId] = ref.split(":");
  const uuid = /^[0-9a-f-]{36}$/i;
  return { userId: userId && uuid.test(userId) ? userId : null, priceId: priceId && uuid.test(priceId) ? priceId : null };
}

async function mpFetch(path: string, init: RequestInit = {}) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new ProviderNotConfiguredError("Mercado Pago");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`mercadopago_http_${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export const mercadoPagoProvider: PaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  currencies: ["ARS"],
  isConfigured: () => Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET),
  async createCheckout(input) {
    if (input.currency !== "ARS") throw new ProviderNotConfiguredError("Mercado Pago (requiere un precio en ARS)");
    const body = {
      reason: `RUNNER 360 · ${input.productName}`,
      external_reference: `${input.userId}:${input.priceId}`,
      payer_email: input.email,
      back_url: input.successUrl,
      status: "pending",
      auto_recurring: {
        frequency: input.interval === "year" ? 12 : 1,
        frequency_type: "months",
        // La API recibe un decimal: se construye desde centavos enteros sin aritmética flotante acumulada.
        transaction_amount: Number(`${Math.trunc(input.amountMinor / 100)}.${String(input.amountMinor % 100).padStart(2, "0")}`),
        currency_id: "ARS",
      },
    };
    const res = await mpFetch("/preapproval", { method: "POST", body: JSON.stringify(body) });
    return { url: String(res.init_point) };
  },
  async parseWebhook({ headers, rawBody, url }) {
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) throw new ProviderNotConfiguredError("Mercado Pago");
    const payload = JSON.parse(rawBody) as { id?: string | number; type?: string; action?: string; data?: { id?: string } };
    const dataId = url.searchParams.get("data.id") ?? payload.data?.id ?? null;
    if (!verifyMercadoPagoSignature({ xSignature: headers.get("x-signature"), xRequestId: headers.get("x-request-id"), dataId, secret })) return null;
    const type = payload.type ?? "unknown";
    const eventId = `${type}:${String(payload.id ?? dataId)}:${payload.action ?? ""}`;
    const base: NormalizedEvent = {
      eventId, type, subscriptionRef: null, userId: null, productId: null, priceId: null,
      status: null, periodStart: null, periodEnd: null, cancelAtPeriodEnd: null, raw: payload,
    };
    if (type !== "subscription_preapproval" || !dataId) return base;
    // El webhook no trae el estado: se consulta a la API (fuente de verdad).
    const pre = await mpFetch(`/preapproval/${encodeURIComponent(dataId)}`);
    const ref = parseExternalReference(pre.external_reference);
    return {
      ...base,
      subscriptionRef: String(pre.id),
      userId: ref.userId,
      priceId: ref.priceId,
      status: mapMercadoPagoStatus(pre.status as string),
      periodEnd: typeof pre.next_payment_date === "string" ? pre.next_payment_date : null,
    };
  },
  async cancelAtPeriodEnd(ref) {
    await mpFetch(`/preapproval/${encodeURIComponent(ref)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  },
};
