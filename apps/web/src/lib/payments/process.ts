import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedEvent, ProviderId } from "./types";

export type ProcessResult = "processed" | "duplicate" | "ignored" | "failed";

/**
 * Procesa un evento de pago ya verificado. Idempotente: la unicidad (provider, provider_event_id)
 * hace que un reintento del proveedor no se aplique dos veces.
 * Debe ejecutarse con el cliente de servicio (las tablas de pagos no admiten escritura de usuarios).
 */
export async function processPaymentEvent(admin: SupabaseClient, provider: ProviderId, ev: NormalizedEvent): Promise<ProcessResult> {
  let eventRowId: string;
  const { data: inserted, error: insErr } = await admin
    .from("payment_events")
    .insert({ provider, provider_event_id: ev.eventId, event_type: ev.type, payload: ev.raw, signature_verified: true })
    .select("id")
    .single();
  if (insErr) {
    if (insErr.code !== "23505") throw new Error(`payment_event_insert:${insErr.code}`);
    // Reintento del proveedor: si ya se procesó, no se aplica otra vez; si había fallado, se reintenta.
    const { data: prev } = await admin
      .from("payment_events")
      .select("id, status")
      .eq("provider", provider)
      .eq("provider_event_id", ev.eventId)
      .single();
    if (!prev || prev.status === "processed" || prev.status === "ignored") return "duplicate";
    eventRowId = prev.id as string;
  } else {
    eventRowId = inserted.id as string;
  }
  const finish = (status: "processed" | "ignored" | "failed", error?: string) =>
    admin.from("payment_events").update({ status, processed_at: new Date().toISOString(), error: error ?? null }).eq("id", eventRowId);

  if (!ev.subscriptionRef || !ev.status) {
    await finish("ignored");
    return "ignored";
  }

  try {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("id")
      .eq("provider", provider)
      .eq("provider_subscription_id", ev.subscriptionRef)
      .maybeSingle();

    const patch: Record<string, unknown> = { status: ev.status };
    if (ev.periodStart) patch.current_period_start = ev.periodStart;
    if (ev.periodEnd) patch.current_period_end = ev.periodEnd;
    if (ev.cancelAtPeriodEnd != null) patch.cancel_at_period_end = ev.cancelAtPeriodEnd;
    if (ev.status === "canceled") patch.canceled_at = new Date().toISOString();

    if (existing) {
      const { error } = await admin.from("subscriptions").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.code);
    } else {
      if (!ev.userId || !ev.priceId) {
        await finish("ignored", "missing_user_or_price");
        return "ignored";
      }
      const { data: price } = await admin.from("subscription_prices").select("id, product_id").eq("id", ev.priceId).maybeSingle();
      if (!price) {
        await finish("failed", "unknown_price");
        return "failed";
      }
      const { error } = await admin.from("subscriptions").insert({
        user_id: ev.userId,
        product_id: price.product_id,
        price_id: price.id,
        provider,
        provider_subscription_id: ev.subscriptionRef,
        ...patch,
      });
      if (error) throw new Error(error.code);
    }
    await finish("processed");
    return "processed";
  } catch (e) {
    await finish("failed", e instanceof Error ? e.message.slice(0, 200) : "unknown");
    return "failed";
  }
}
