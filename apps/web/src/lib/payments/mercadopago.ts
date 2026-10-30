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
 * Requiere MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET (ver docs/payments.md). El importe se cobra en pesos:
 * precio de lista en USD × cotización del día (lib/actions/billing.ts).
 * El webhook solo trae el id: el estado real se consulta a la API (nunca se confía en el cuerpo).
 * Eventos: "subscription_preapproval" (alta, pausa, baja) y "subscription_authorized_payment"
 * (cada débito automático mensual: si se aprueba, libera el mes siguiente del plan).
 *
 * Plan anual: pago único (Checkout Pro, /checkout/preferences) por 12 meses, sin renovación
 * automática y con cuotas. Llega como evento "payment"; el período lo calcula lib/payments/process.ts.
 */

// MP_API_BASE solo para pruebas locales (servidor simulado de Mercado Pago); en producción, la API real.
const api = () => process.env.MP_API_BASE?.trim() || "https://api.mercadopago.com";

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
  const payment = (ap.payment ?? {}) as { id?: unknown; status?: unknown; status_detail?: unknown };
  const ps = String(payment.status ?? "");
  const status: PaymentStatus =
    ps === "approved" ? "approved" : ps === "refunded" || ps === "charged_back" ? "refunded" : ps === "rejected" || ps === "cancelled" || ap.status === "cancelled" ? "rejected" : "pending";
  const detail = [payment.status_detail, ap.rejection_code, ap.status_detail].find((d): d is string => typeof d === "string" && d.length > 0);
  const amount = typeof ap.transaction_amount === "number" ? Math.round(ap.transaction_amount * 100) : null;
  const when = [ap.debit_date, ap.last_modified, ap.date_created].find((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return {
    providerPaymentId: String(ap.id),
    status,
    amountMinor: amount,
    currency: typeof ap.currency_id === "string" ? ap.currency_id : null,
    paidAt: when ?? now,
    ...(status === "rejected" ? { failureCode: detail ?? null } : {}),
  };
}

/**
 * Pago único del plan anual. Aprobado → acceso activo; en proceso → pendiente; devuelto o
 * contracargo → se corta el acceso; rechazado → se ignora (no crea nada).
 */
export function mapMercadoPagoOneOff(p: Record<string, unknown>, now = new Date().toISOString()): { status: SubscriptionStatus | null; payment: NormalizedPayment | null } {
  const s = String(p.status ?? "");
  const status: SubscriptionStatus | null =
    s === "approved" ? "active" : s === "pending" || s === "in_process" || s === "authorized" ? "pending" : s === "refunded" || s === "charged_back" ? "cancelled" : null;
  if (p.id === undefined || p.id === null || status === null || status === "pending") return { status, payment: null };
  const when = [p.date_approved, p.date_last_updated, p.date_created].find((d): d is string => typeof d === "string" && !Number.isNaN(Date.parse(d)));
  return {
    status,
    payment: {
      providerPaymentId: String(p.id),
      status: status === "active" ? "approved" : "refunded",
      amountMinor: typeof p.transaction_amount === "number" ? Math.round(p.transaction_amount * 100) : null,
      currency: typeof p.currency_id === "string" ? p.currency_id : null,
      paidAt: when ?? now,
    },
  };
}

/** Preferencia de Checkout Pro para el plan anual (pura, testeable). */
export function annualPreference(req: { userId: string; email: string; productCode: string; productName: string; amount: number; currency: string; successUrl: string; cancelUrl: string }) {
  return {
    items: [{ id: req.productCode, title: `RUNNER 360 · ${req.productName} (12 meses)`, quantity: 1, unit_price: req.amount, currency_id: req.currency }],
    external_reference: `${req.userId}:${req.productCode}`,
    payer: { email: req.email },
    back_urls: { success: req.successUrl, pending: req.successUrl, failure: req.cancelUrl },
    auto_return: "approved",
    statement_descriptor: "RUNNER360",
  };
}

/** external_reference = "<userId>:<productCode>" (pura, testeable). */
export function parseExternalReference(ref: unknown): { userId: string | null; productCode: string | null } {
  if (typeof ref !== "string") return { userId: null, productCode: null };
  const m = /^([0-9a-f-]{36}):([a-z0-9_]{2,40})$/i.exec(ref);
  return m ? { userId: m[1] ?? null, productCode: m[2] ?? null } : { userId: null, productCode: null };
}

export type MpAccountCheck = { ok: boolean; message: string };

/**
 * Evalúa la cuenta dueña del Access Token (GET /users/me) frente a MP_ENV (pura, testeable).
 * Es de prueba si la cuenta trae la etiqueta "test_user" (token APP_USR- de un usuario de prueba) o si
 * el token es TEST- (credenciales de prueba de una cuenta real: /users/me informa la cuenta real).
 */
export function assessMercadoPagoAccount(me: Record<string, unknown>, mpEnv: "test" | "prod" | null, testToken = false): MpAccountCheck {
  const tags = Array.isArray(me.tags) ? me.tags.map(String) : [];
  const isTest = testToken || tags.includes("test_user");
  const who = `${typeof me.nickname === "string" ? me.nickname : `cuenta ${String(me.id ?? "?")}`} · ${testToken ? "credenciales de prueba" : isTest ? "cuenta de prueba" : "cuenta real"}`;
  if (me.site_id !== "MLA") return { ok: false, message: `${who}: no es una cuenta de Argentina (${String(me.site_id ?? "?")}). Los cobros son en pesos argentinos.` };
  if (mpEnv === "prod" && isTest) return { ok: false, message: `${who}: MP_ENV=prod pero el token es de una cuenta de prueba.` };
  if (mpEnv === "test" && !isTest) return { ok: false, message: `${who}: MP_ENV=test pero el token es de una cuenta real (los cobros serían reales).` };
  if (!mpEnv) return { ok: true, message: `${who}. Definí MP_ENV=${isTest ? "test" : "prod"} para activar la validación.` };
  return { ok: true, message: `${who}. Credenciales válidas.` };
}

/** La Public Key tiene forma de UUID (TEST-xxxxxxxx-xxxx-…); el Access Token, TEST-<números>-<fecha>-<hex>-<números>. */
export function looksLikePublicKey(token: string): boolean {
  return /^(TEST|APP_USR)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

/** Verifica el Access Token contra la API. Nunca expone el token ni datos de pago. */
export async function checkMercadoPagoAccount(mpEnv: "test" | "prod" | null): Promise<MpAccountCheck> {
  if (!serverEnv.mercadoPagoAccessToken) return { ok: false, message: "Falta MP_ACCESS_TOKEN." };
  if (looksLikePublicKey(serverEnv.mercadoPagoAccessToken)) return { ok: false, message: "MP_ACCESS_TOKEN tiene la Public Key. Copiá el Access Token (está en la misma pantalla de credenciales)." };
  try {
    const res = await fetch(`${api()}/users/me`, {
      headers: { Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, message: "Mercado Pago rechazó el Access Token (vencido, revocado o mal copiado)." };
    if (res.status === 403) return { ok: false, message: "Mercado Pago no le da permiso a este Access Token (403). Revisá que sea el de la aplicación RUNNER 360." };
    if (!res.ok) return { ok: false, message: `Mercado Pago respondió ${res.status}. Probá más tarde.` };
    return assessMercadoPagoAccount((await res.json()) as Record<string, unknown>, mpEnv, serverEnv.mercadoPagoAccessToken.startsWith("TEST-"));
  } catch {
    return { ok: false, message: "No se pudo contactar a Mercado Pago." };
  }
}

async function mpFetch(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(`${api()}${path}`, {
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

async function paymentEvent(base: NormalizedSubscriptionEvent, id: string): Promise<NormalizedSubscriptionEvent> {
  const p = await mpFetch(`/v1/payments/${encodeURIComponent(id)}`);
  // Los débitos de la suscripción mensual también son "payment": esos llegan por authorized_payment.
  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  if (p.operation_type === "recurring_payment" || meta.preapproval_id) return base;
  const ref = parseExternalReference(p.external_reference);
  if (!ref.userId || !ref.productCode) return base;
  const { status, payment } = mapMercadoPagoOneOff(p);
  return { ...base, prepaid: true, providerSubscriptionId: `payment:${id}`, userId: ref.userId, productCode: ref.productCode, status, payment };
}

/** Último débito de una suscripción (el primero se cobra al darla de alta). null si no hay o si falla la consulta. */
async function latestAuthorizedPayment(preapprovalId: string): Promise<NormalizedPayment | null> {
  try {
    const res = await mpFetch(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`);
    const results = (Array.isArray(res.results) ? res.results : []) as Record<string, unknown>[];
    const payments = results.map((ap) => mapMercadoPagoPayment(ap)).filter((p): p is NormalizedPayment => p !== null);
    return payments.sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Parámetros con los que Mercado Pago vuelve a la app (pura, testeable): `preapproval_id` en la
 * suscripción mensual; `payment_id` (o `collection_id`) en Checkout Pro. Se validan antes de consultar la API.
 */
export function parseReturnParams(params: URLSearchParams): { preapprovalId: string | null; paymentId: string | null } {
  const pre = params.get("preapproval_id");
  const pay = params.get("payment_id") ?? params.get("collection_id");
  return {
    preapprovalId: pre && /^[a-z0-9]{6,64}$/i.test(pre) ? pre : null,
    paymentId: pay && /^\d{1,20}$/.test(pay) ? pay : null,
  };
}

/**
 * Query de la URL de vuelta, tolerando la forma mal armada "?estado=procesando?preapproval_id=…"
 * (Mercado Pago suma su "?" a una URL que ya tenía query). Pura, testeable.
 */
export function returnSearchParams(query: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== "string") continue;
    const [head = "", ...rest] = value.split("?");
    out.set(key, head);
    if (rest.length) for (const [k, v] of new URLSearchParams(rest.join("&"))) if (!out.has(k)) out.set(k, v);
  }
  return out;
}

export const mercadoPagoProvider: PaymentProvider = {
  id: "mercadopago",
  label: "Mercado Pago",
  isConfigured: () => Boolean(serverEnv.mercadoPagoAccessToken && serverEnv.mercadoPagoWebhookSecret),

  async createCheckout(req) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Mercado Pago");
    // Importe decimal derivado de unidades menores con aritmética entera.
    const amount = `${Math.trunc(req.price.amount_minor / 100)}.${String(req.price.amount_minor % 100).padStart(2, "0")}`;
    if (req.product.billing_interval === "year") {
      const pref = annualPreference({
        userId: req.userId,
        email: req.email,
        productCode: req.product.code,
        productName: req.product.name,
        amount: Number(amount),
        currency: req.price.currency,
        successUrl: req.successUrl,
        cancelUrl: req.cancelUrl,
      });
      const res = await mpFetch("/checkout/preferences", { method: "POST", body: JSON.stringify(pref) });
      if (typeof res.init_point !== "string") throw new Error("Mercado Pago no devolvió URL de pago");
      return { url: res.init_point };
    }
    const body = {
      reason: `RUNNER 360 · ${req.product.name}`,
      external_reference: `${req.userId}:${req.product.code}`,
      payer_email: req.email,
      // Mercado Pago agrega "?preapproval_id=…" a la vuelta aunque la URL ya tenga "?": se manda sin query.
      back_url: req.successUrl.split("?")[0],
      status: "pending",
      auto_recurring: {
        frequency: 1,
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
    const body = JSON.parse(rawBody) as { id?: unknown; type?: string; topic?: string; action?: string; data?: { id?: unknown } };
    const dataId = body.data?.id ? String(body.data.id) : null;
    const eventId = body.id ? String(body.id) : `${body.type}:${dataId}:${headers.get("x-request-id") ?? ""}`;
    const base: NormalizedSubscriptionEvent = { providerEventId: eventId, eventType: body.type ?? body.action ?? "unknown", providerSubscriptionId: null, userId: null, productCode: null, status: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: null };
    if (!dataId) return base;
    if (body.type === "subscription_preapproval") return preapprovalEvent(base, dataId);
    if (body.type === "payment" || body.topic === "payment") return paymentEvent(base, dataId);
    if (body.type === "subscription_authorized_payment") {
      const ap = await mpFetch(`/authorized_payments/${encodeURIComponent(dataId)}`);
      const preId = typeof ap.preapproval_id === "string" ? ap.preapproval_id : null;
      if (!preId) return base;
      const payment = mapMercadoPagoPayment(ap);
      // Sin motivo en el débito: se consulta el pago (status_detail) para explicarle al usuario qué pasó.
      const paymentId = (ap.payment as { id?: unknown } | undefined)?.id;
      if (payment?.status === "rejected" && !payment.failureCode && paymentId) {
        const p = await mpFetch(`/v1/payments/${encodeURIComponent(String(paymentId))}`).catch(() => null);
        if (p && typeof p.status_detail === "string") payment.failureCode = p.status_detail;
      }
      return { ...(await preapprovalEvent(base, preId)), payment };
    }
    return base;
  },

  async eventFromReturn(params) {
    if (!this.isConfigured()) return null;
    const { preapprovalId, paymentId } = parseReturnParams(params);
    const base: NormalizedSubscriptionEvent = { providerEventId: `return:${preapprovalId ?? paymentId}`, eventType: "checkout_return", providerSubscriptionId: null, userId: null, productCode: null, status: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: null };
    if (preapprovalId) return { ...(await preapprovalEvent(base, preapprovalId)), payment: await latestAuthorizedPayment(preapprovalId) };
    if (paymentId) return paymentEvent(base, paymentId);
    return null;
  },

  async cancelAtPeriodEnd(id) {
    if (!this.isConfigured()) throw new ProviderNotConfiguredError("Mercado Pago");
    await mpFetch(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  },
};
