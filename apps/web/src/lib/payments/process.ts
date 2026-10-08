import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import type { NormalizedSubscriptionEvent, PaymentProvider, WebhookInput } from "./types";

export type WebhookOutcome =
  | { status: 200; body: { received: true; duplicate?: boolean; ignored?: boolean } }
  | { status: 400 | 401 | 500 | 503; body: { error: string } };

/**
 * Procesa un webhook de pago de forma idempotente:
 *  1. Verifica la firma (si falla: 401, no se procesa).
 *  2. Registra el evento en payment_events con clave única (provider, provider_event_id).
 *     Si ya existía, responde 200 sin reprocesar.
 *  3. Aplica el cambio de estado sobre subscriptions con service_role.
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
    await applySubscriptionEvent(admin, provider.id, event);
    await admin.from("payment_events").update({ processed_at: new Date().toISOString() }).eq("id", eventRowId);
  } catch (e) {
    logError(`webhook:${provider.id}:apply`, e);
    await admin.from("payment_events").update({ processing_error: e instanceof Error ? e.message : "error" }).eq("id", eventRowId);
    // 200 para que el proveedor no reintente indefinidamente; queda visible en administración.
  }
  return { status: 200, body: { received: true } };
}

async function applySubscriptionEvent(admin: SupabaseClient, provider: string, event: NormalizedSubscriptionEvent): Promise<void> {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("provider", provider)
    .eq("provider_subscription_id", event.providerSubscriptionId)
    .maybeSingle<{ id: string }>();

  const changes: Record<string, unknown> = { status: event.status };
  if (event.currentPeriodStart) changes.current_period_start = event.currentPeriodStart;
  if (event.currentPeriodEnd) changes.current_period_end = event.currentPeriodEnd;
  if (event.cancelAtPeriodEnd !== null) changes.cancel_at_period_end = event.cancelAtPeriodEnd;
  if (event.status === "cancelled") changes.cancelled_at = new Date().toISOString();
  if (event.status === "active") changes.started_at = event.currentPeriodStart ?? new Date().toISOString();

  if (existing) {
    const { error } = await admin.from("subscriptions").update(changes).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  if (!event.userId || !event.productCode) throw new Error("Evento sin referencia de usuario o producto");
  const { data: product } = await admin.from("subscription_products").select("id").eq("code", event.productCode).maybeSingle<{ id: string }>();
  if (!product) throw new Error("Producto desconocido");
  const { error } = await admin.from("subscriptions").insert({
    user_id: event.userId,
    product_id: product.id,
    provider,
    provider_subscription_id: event.providerSubscriptionId,
    ...changes,
  });
  if (error) throw new Error(error.message);
}
