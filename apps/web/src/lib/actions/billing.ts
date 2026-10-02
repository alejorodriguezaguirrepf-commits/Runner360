"use server";

import type { PriceRow, ProductRow, SubscriptionRow } from "@runner360/shared";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import { getProvider } from "@/lib/payments/registry";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({ productId: z.uuid(), provider: z.enum(["mercadopago", "stripe"]) });

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOnboardedSession();
  const parsed = checkoutSchema.safeParse({ productId: formData.get("productId"), provider: formData.get("provider") });
  if (!parsed.success) return { ok: false, message: "Opción inválida." };
  const provider = getProvider(parsed.data.provider);
  if (!provider || !provider.isConfigured()) {
    return { ok: false, message: `${provider?.label ?? "El medio de pago"} está pendiente de configuración. Todavía no se pueden procesar pagos.` };
  }
  const [{ data: product }, { data: prices }] = await Promise.all([
    supabase.from("subscription_products").select("*").eq("id", parsed.data.productId).eq("active", true).maybeSingle<ProductRow>(),
    supabase.from("product_prices").select("*").eq("product_id", parsed.data.productId).eq("active", true).eq("provider", parsed.data.provider),
  ]);
  const price = ((prices ?? []) as PriceRow[])[0];
  if (!product || product.tier !== "premium" || !price) return { ok: false, message: "Este producto todavía no tiene precio configurado para ese medio de pago." };

  let url: string;
  try {
    ({ url } = await provider.createCheckout({
      userId: user.id,
      email: user.email ?? "",
      product,
      price,
      successUrl: `${publicEnv.siteUrl}/suscripcion?estado=procesando`,
      cancelUrl: `${publicEnv.siteUrl}/suscripcion`,
    }));
  } catch (e) {
    logError("checkout", e);
    return { ok: false, message: "No pudimos iniciar el pago. Probá más tarde." };
  }
  redirect(url);
}

export async function cancelSubscriptionAction(_prev: ActionState): Promise<ActionState> {
  const { supabase, user } = await requireOnboardedSession();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow & { provider_subscription_id: string | null }>();
  if (!sub) return { ok: false, message: "No tenés una suscripción activa." };
  if (sub.provider === "manual") return { ok: false, message: "Tu acceso Premium fue otorgado por el equipo. Escribinos para modificarlo." };
  if (sub.provider === "apple" || sub.provider === "google") return { ok: false, message: "Las suscripciones de la app se cancelan desde la tienda de tu teléfono." };
  const provider = getProvider(sub.provider);
  const admin = createAdminClient();
  if (!provider?.isConfigured() || !admin || !sub.provider_subscription_id) return { ok: false, message: "La cancelación automática está pendiente de configuración." };
  try {
    await provider.cancelAtPeriodEnd(sub.provider_subscription_id);
    await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);
  } catch (e) {
    logError("cancelSubscription", e);
    return { ok: false, message: "No pudimos cancelar. Probá más tarde." };
  }
  return { ok: true, message: "Cancelaste la renovación. Mantenés Premium hasta el fin del período pago." };
}
