import { serverEnv } from "@/lib/env.server";
import { verifyMercadoPagoSignature } from "./signatures";
import { ProviderNotConfiguredError, type NormalizedSubscriptionEvent, type PaymentProvider, type SubscriptionStatus, type WebhookInput } from "./types";

/**
 * Adaptador Mercado Pago Suscripciones (preapproval), vía API REST sin SDK.
 * NO PROBADO contra la cuenta real: requiere MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET
 * y un precio activo en ARS con provider = 'mercadopago'.
 * El webhook solo trae el id: el estado real se consulta a la API (nunca se confía en el cuerpo).
 */

const API = "https://api.mercadopago.com";

export function mapMercadoPagoStatus(s: string): SubscriptionStatus {
  switch (s) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

/** external_reference = "<userId>:<productCode>" (pura, testeable). */
export function parseExternalReference(ref: unknown): { userId: string | null; productCode: string | null } {
  if (typeof ref !== "string") return { userId: null, productCode: null };
  const m = /^([0-9a-f-]{36}):([a-z0-9_]{2,40})$/i.exec(ref);
  return m ? { userId: m[1] ?? null, productCode: m[2] ?? null } : { userId: null, productCode: null };
}

async function mpFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}`);
  return json;
}

export const mercadoPagoProvider: PaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  isConfigured: () => Boolean(serverEnv.mercadoPagoAccessToken && serverEnv.mercadoPagoWebhookSecret),

  async createCheckout(req) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Mercado Pago");
    // Importe decimal derivado de unidades menores con aritmética entera.
    const amount = `${Math.trunc(req.price.amount_minor / 100)}.${String(req.price.amount_minor % 100).padStart(2, "0")}`;
    const body = {
      reason: `RUNNER 360 · ${req.product.name}`,
      external_reference: `${req.userId}:${req.product.code}`,
      payer_email: req.email,
      back_url: req.successUrl,
      status: "pending",
      auto_recurring: {
        frequency: req.product.billing_interval === "year" ? 12 : 1,
        frequency_type: "months",
        transaction_amount: Number(amount),
        currency_id: req.price.currency,
      },
    };
    const res = await mpFetch("/preapproval", { method: "POST", body: JSON.stringify(body) });
    if (typeof res.init_point !== "string") throw new Error("Mercado Pago no devolvió URL de pago");
    return { url: res.init_point };
  },

  verifyWebhook({ headers, url, rawBody }: WebhookInput) {
    let dataId = url.searchParams.get("data.id");
    if (!dataId) {
      try {
        dataId = String((JSON.parse(rawBody) as { data?: { id?: unknown } }).data?.id ?? "") || null;
      } catch {
        dataId = null;
      }
    }
    return verifyMercadoPagoSignature({
      xSignature: headers.get("x-signature"),
      xRequestId: headers.get("x-request-id"),
      dataId,
      secret: serverEnv.mercadoPagoWebhookSecret,
    });
  },

  async parseWebhook({ rawBody, headers }: WebhookInput): Promise<NormalizedSubscriptionEvent | null> {
    const body = JSON.parse(rawBody) as { id?: unknown; type?: string; action?: string; data?: { id?: unknown } };
    const dataId = body.data?.id ? String(body.data.id) : null;
    const eventId = body.id ? String(body.id) : `${body.type}:${dataId}:${headers.get("x-request-id") ?? ""}`;
    const base: NormalizedSubscriptionEvent = { providerEventId: eventId, eventType: body.type ?? body.action ?? "unknown", providerSubscriptionId: null, userId: null, productCode: null, status: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: null };
    if (body.type !== "subscription_preapproval" || !dataId) return base;
    const pre = await mpFetch(`/preapproval/${encodeURIComponent(dataId)}`);
    const ref = parseExternalReference(pre.external_reference);
    return {
      ...base,
      providerSubscriptionId: dataId,
      userId: ref.userId,
      productCode: ref.productCode,
      status: mapMercadoPagoStatus(String(pre.status ?? "")),
      currentPeriodStart: typeof pre.date_created === "string" ? pre.date_created : null,
      currentPeriodEnd: typeof pre.next_payment_date === "string" ? pre.next_payment_date : null,
      cancelAtPeriodEnd: null,
    };
  },

  async cancelAtPeriodEnd(id) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Mercado Pago");
    await mpFetch(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  },
};
