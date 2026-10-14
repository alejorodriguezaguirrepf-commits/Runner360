import { serverEnv } from "@/lib/env.server";
import { verifyMercadoPagoSignature } from "./signatures";
import {
  ProviderNotConfiguredError,
  type NormalizedPayment,
  type NormalizedSubscriptionEvent,
  type PaymentProvider,
  type PaymentStatus,
  type SubscriptionStatus,
  type WebhookInput,
} from "./types";

/**
 * Adaptador Mercado Pago Suscripciones (preapproval), vía API REST sin SDK.
 * NO PROBADO contra la cuenta real: requiere MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET
 * y un precio activo en ARS con provider = 'mercadopago'.
 * El webhook solo trae el id: el estado real se consulta a la API (nunca se confía en el cuerpo).
 * Eventos: "subscription_preapproval" (alta, pausa, baja) y "subscription_authorized_payment"
 * (cada débito automático mensual: si se aprueba, libera el mes siguiente del plan).
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

/** Estado de un débito de la suscripción (authorized_payment). Solo "approved" libera un mes. */
export function mapMercadoPagoPayment(ap: Record<string, unknown>, now = new Date().toISOString()): NormalizedPayment | null {
  if (ap.id === undefined || ap.id === null) return null;
  const payment = (ap.payment ?? {}) as { id?: unknown; status?: unknown };
  const ps = String(payment.status ?? "");
  const status: PaymentStatus =
    ps === "approved" ? "approved" : ps === "refunded" || ps === "charged_back" ? "refunded" : ps === "rejected" || ps === "cancelled" || ap.status === "cancelled" ? "rejected" : "pending";
  const amount = typeof ap.transaction_amount === "number" ? Math.round(ap.transaction_amount * 100) : null;
  const when = [ap.debit_date, ap.last_modified, ap.date_created].find((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return {
    providerPaymentId: String(ap.id),
    status,
    amountMinor: amount,
    currency: typeof ap.currency_id === "string" ? ap.currency_id : null,
    paidAt: when ?? now,
  };
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

async function preapprovalEvent(base: NormalizedSubscriptionEvent, id: string): Promise<NormalizedSubscriptionEvent> {
  const pre = await mpFetch(`/preapproval/${encodeURIComponent(id)}`);
  const ref = parseExternalReference(pre.external_reference);
  return {
    ...base,
    providerSubscriptionId: id,
    userId: ref.userId,
    productCode: ref.productCode,
    status: mapMercadoPagoStatus(String(pre.status ?? "")),
    currentPeriodStart: typeof pre.date_created === "string" ? pre.date_created : null,
    currentPeriodEnd: typeof pre.next_payment_date === "string" ? pre.next_payment_date : null,
    cancelAtPeriodEnd: null,
  };
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
    if (!dataId) return base;
    if (body.type === "subscription_preapproval") return preapprovalEvent(base, dataId);
    if (body.type === "subscription_authorized_payment") {
      const ap = await mpFetch(`/authorized_payments/${encodeURIComponent(dataId)}`);
      const preId = typeof ap.preapproval_id === "string" ? ap.preapproval_id : null;
      if (!preId) return base;
      return { ...(await preapprovalEvent(base, preId)), payment: mapMercadoPagoPayment(ap) };
    }
    return base;
  },

  async cancelAtPeriodEnd(id) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Mercado Pago");
    await mpFetch(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  },
};
