import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import { notifyPayment } from "@/lib/notifications/payments";
import { graceEnd } from "@/lib/notifications/payment-texts";
import { prepaidPeriod } from "./annual";
import type { NormalizedPayment, NormalizedSubscriptionEvent, PaymentProvider, WebhookInput } from "./types";

export type WebhookOutcome =
  | { status: 200; body: { received: true; duplicate?: boolean; ignored?: boolean } }
  | { status: 400 | 401 | 500 | 503; body: { error: string } };

/**
 * Procesa un webhook de pago de forma idempotente:
 *  1. Verifica la firma (si falla: 401, no se procesa).
 *  2. Registra el evento en payment_events con clave única (provider, provider_event_id).
 *     Si ya existía, responde 200 sin reprocesar.
 *  3. Aplica el cambio de estado sobre subscriptions con service_role.
 *  4. Si el evento trae un débito automático, lo registra en subscription_payments (cada débito
 *     aprobado libera un mes del plan en curso; ver enrollment_open_weeks en la base).
 *  5. Débito rechazado: la suscripción pasa a past_due con 5 días de gracia (Mercado Pago
 *     reintenta el cobro); uno aprobado la regulariza. Avisa al admin y al usuario (sin duplicados).
 */
export async function processWebhook(provider: PaymentProvider, input: WebhookInput, admin: SupabaseClient | null): Promise<WebhookOutcome> {
  if (!provider.isConfigured() || !admin) return { status: 503, body: { error: "Integración de pagos pendiente de configuración" } };
  if (!provider.verifyWebhook(input)) return { status: 401, body: { error: "Firma inválida" } };

  let event: NormalizedSubscriptionEvent | null;
  try {
    event = await provider.parseWebhook(input);
  } catch (e) {
    logError(`webhook:${provider.id}:parse`, e);
    return { status: 500, body: { error: "No se pudo interpretar el evento" } };
  }
  if (!event) return { status: 400, body: { error: "Evento inválido" } };

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody);
  } catch {
    payload = {};
  }
  const { data: inserted, error: insertError } = await admin
    .from("payment_events")
    .upsert(
      { provider: provider.id, provider_event_id: event.providerEventId, event_type: event.eventType, signature_valid: true, payload },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) {
    logError(`webhook:${provider.id}:store`, insertError);
    return { status: 500, body: { error: "No se pudo registrar el evento" } };
  }
  if (!inserted || inserted.length === 0) return { status: 200, body: { received: true, duplicate: true } };
  const eventRowId = (inserted[0] as { id: string }).id;

  if (!event.providerSubscriptionId || !event.status) {
    await admin.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", eventRowId);
    return { status: 200, body: { received: true, ignored: true } };
  }

  try {
    const applied = event.prepaid ? { sub: await applyPrepaidEvent(admin, provider.id, event), recovered: false, graceUntil: null } : await applySubscriptionEvent(admin, provider.id, event);
    const subscription = applied.sub;
    if (subscription && event.payment) {
      await recordPayment(admin, provider.id, subscription, event.payment);
      await notifyPayment(admin, provider.id, subscription, event.payment, { recovered: applied.recovered, graceUntil: applied.graceUntil });
    }
    await admin.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", eventRowId);
  } catch (e) {
    logError(`webhook:${provider.id}:apply`, e);
    await admin.from("payment_events").update({ processing_error: e instanceof Error ? e.message : "error" }).eq("id", eventRowId);
    // 200 para que el proveedor no reintente indefinidamente; queda visible en administración.
  }
  return { status: 200, body: { received: true } };
}

type SubscriptionRef = { id: string; user_id: string };
type Applied = { sub: SubscriptionRef | null; recovered: boolean; graceUntil: string | null };

/**
 * Estado de una suscripción mensual según el débito del evento (pura, testeable):
 *  - rechazado: past_due con gracia (se conserva la gracia ya abierta para no extenderla con cada reintento);
 *  - aprobado: activa, sin gracia (si venía con problemas, se regulariza);
 *  - sin débito: un aviso de "autorizada" no saca de past_due ni de expired (eso lo decide un débito aprobado).
 */
export function debitStatus(
  existing: { status: string; grace_until: string | null } | null,
  eventStatus: string | null,
  payment: { status: string } | null | undefined,
  now = new Date(),
): { status?: string; graceUntil?: string | null; recovered: boolean } {
  const troubled = existing?.status === "past_due" || existing?.status === "expired";
  if (payment?.status === "rejected" && eventStatus !== "cancelled") {
    const open = existing?.status === "past_due" && existing.grace_until && new Date(existing.grace_until) > now;
    return { status: "past_due", graceUntil: open ? existing.grace_until : graceEnd(now).toISOString(), recovered: false };
  }
  if (payment?.status === "approved" && eventStatus !== "cancelled") return { status: "active", graceUntil: null, recovered: troubled };
  if (troubled && eventStatus === "active") return { recovered: false };
  return { status: eventStatus ?? undefined, recovered: false };
}

async function applySubscriptionEvent(admin: SupabaseClient, provider: string, event: NormalizedSubscriptionEvent): Promise<Applied> {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, user_id, status, grace_until")
    .eq("provider", provider)
    .eq("provider_subscription_id", event.providerSubscriptionId)
    .maybeSingle<SubscriptionRef & { status: string; grace_until: string | null }>();

  const debit = debitStatus(existing ?? null, event.status, event.payment);
  const changes: Record<string, unknown> = {};
  if (debit.status) changes.status = debit.status;
  if (debit.graceUntil !== undefined) changes.grace_until = debit.graceUntil;
  if (event.currentPeriodStart) changes.current_period_start = event.currentPeriodStart;
  if (event.currentPeriodEnd) changes.current_period_end = event.currentPeriodEnd;
  if (event.cancelAtPeriodEnd !== null) changes.cancel_at_period_end = event.cancelAtPeriodEnd;
  if (event.status === "cancelled") changes.cancelled_at = new Date().toISOString();
  if (debit.status === "active") changes.started_at = event.currentPeriodStart ?? new Date().toISOString();
  const result = (sub: SubscriptionRef): Applied => ({ sub, recovered: debit.recovered, graceUntil: (changes.grace_until as string | null | undefined) ?? existing?.grace_until ?? null });

  if (existing) {
    const { error } = await admin.from("subscriptions").update(changes).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return result({ id: existing.id, user_id: existing.user_id });
  }
  if (!event.userId || !event.productCode) throw new Error("Evento sin referencia de usuario o producto");
  const { data: product } = await admin.from("subscription_products").select("id").eq("code", event.productCode).maybeSingle<{ id: string }>();
  if (!product) throw new Error("Producto desconocido");
  const { data: created, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: event.userId,
      product_id: product.id,
      provider,
      provider_subscription_id: event.providerSubscriptionId,
      ...changes,
    })
    .select("id, user_id")
    .single<SubscriptionRef>();
  if (error || !created) throw new Error(error?.message ?? "No se pudo crear la suscripción");
  return result(created);
}

type PrepaidRow = SubscriptionRef & { status: string; current_period_start: string | null; current_period_end: string | null };

/**
 * Pago único del plan anual (un registro de suscripción por pago, sin renovación automática).
 * Al aprobarse: 12 meses desde el pago, o desde que termina el anual vigente (renovación anticipada).
 * Devolución o contracargo: el acceso termina en ese momento. Solo productos anuales.
 */
async function applyPrepaidEvent(admin: SupabaseClient, provider: string, event: NormalizedSubscriptionEvent): Promise<SubscriptionRef | null> {
  if (!event.userId || !event.productCode) throw new Error("Pago sin referencia de usuario o producto");
  const { data: product } = await admin
    .from("subscription_products")
    .select("id, billing_interval")
    .eq("code", event.productCode)
    .maybeSingle<{ id: string; billing_interval: string | null }>();
  if (!product) throw new Error("Producto desconocido");
  if (product.billing_interval !== "year") return null;

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, user_id, status, current_period_start, current_period_end")
    .eq("provider", provider)
    .eq("provider_subscription_id", event.providerSubscriptionId)
    .maybeSingle<PrepaidRow>();
  const now = new Date();
  const changes: Record<string, unknown> = { status: event.status, cancel_at_period_end: true };

  if (event.status === "active" && !existing?.current_period_end) {
    const { data: others } = await admin
      .from("subscriptions")
      .select("current_period_end, subscription_products!inner(billing_interval)")
      .eq("user_id", event.userId)
      .eq("subscription_products.billing_interval", "year")
      .in("status", ["active", "cancelled"])
      .gt("current_period_end", now.toISOString())
      .neq("provider_subscription_id", event.providerSubscriptionId ?? "");
    const ends = ((others ?? []) as { current_period_end: string }[]).map((o) => new Date(o.current_period_end));
    const paidAt = event.payment ? new Date(event.payment.paidAt) : now;
    const { start, end } = prepaidPeriod(paidAt, ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null);
    Object.assign(changes, { started_at: paidAt.toISOString(), current_period_start: start.toISOString(), current_period_end: end.toISOString() });
  }
  if (event.status === "cancelled") {
    const start = existing?.current_period_start ? new Date(existing.current_period_start) : null;
    Object.assign(changes, {
      cancelled_at: now.toISOString(),
      current_period_start: new Date(Math.min(start?.getTime() ?? now.getTime(), now.getTime() - 1000)).toISOString(),
      current_period_end: now.toISOString(),
    });
  }

  if (existing) {
    // Un pago ya aprobado no vuelve a "pendiente" por un aviso que llega tarde.
    if (existing.status === "active" && event.status === "pending") return existing;
    const { error } = await admin.from("subscriptions").update(changes).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing;
  }
  const { data: created, error } = await admin
    .from("subscriptions")
    .insert({ user_id: event.userId, product_id: product.id, provider, provider_subscription_id: event.providerSubscriptionId, ...changes })
    .select("id, user_id")
    .single<SubscriptionRef>();
  if (error || !created) throw new Error(error?.message ?? "No se pudo registrar el plan anual");
  return created;
}

/** Idempotente por (provider, provider_payment_id): un débito que cambia de estado se actualiza. */
async function recordPayment(admin: SupabaseClient, provider: string, subscription: SubscriptionRef, payment: NormalizedPayment): Promise<void> {
  const { error } = await admin.from("subscription_payments").upsert(
    {
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      provider,
      provider_payment_id: payment.providerPaymentId,
      status: payment.status,
      amount_minor: payment.amountMinor,
      currency: payment.currency,
      paid_at: payment.paidAt,
      failure_code: payment.status === "rejected" ? (payment.failureCode ?? null) : null,
    },
    { onConflict: "provider,provider_payment_id" },
  );
  if (error) throw new Error(error.message);
}
