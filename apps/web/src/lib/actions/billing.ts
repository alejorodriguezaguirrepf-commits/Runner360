"use server";

import type { PriceRow, ProductRow, SubscriptionRow } from "@runner360/shared";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { arsEquivalent } from "@/lib/data/pricing";
import { publicEnv, readEnv } from "@/lib/env";
import { canonicalSiteUrl } from "@/lib/site-url";
import { isStale, latestRate, refreshRate } from "@/lib/fx/rates";
import { logError } from "@/lib/log";
import { readPaymentsConfig } from "@/lib/payments/config";
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
    supabase.from("product_prices").select("*").eq("product_id", parsed.data.productId).eq("active", true),
  ]);
  const active = (prices ?? []) as PriceRow[];
  const own = active.find((pr) => pr.provider === parsed.data.provider);
  const list = active.find((pr) => pr.provider === null) ?? null;
  if (!product || product.tier !== "premium" || (!own && !list)) return { ok: false, message: "Este producto todavía no tiene precio configurado para ese medio de pago." };
  // Reglas de compra (también se validan acá, no solo en la pantalla).
  const [{ data: premium }, { data: annualUntil }] = await Promise.all([
    supabase.rpc("has_premium", { p_user: user.id }),
    supabase.rpc("annual_access_until", { p_user: user.id }),
  ]);
  if (product.billing_interval === "year") {
    if (parsed.data.provider !== "mercadopago") return { ok: false, message: "El plan anual se paga con Mercado Pago." };
    if (premium === true && !annualUntil) return { ok: false, message: "Para pasar al anual, primero cancelá la renovación mensual y esperá a que termine el mes pago." };
  } else if (premium === true) {
    return { ok: false, message: "Ya tenés una suscripción activa." };
  }

  let price: PriceRow;
  if (parsed.data.provider === "mercadopago") {
    // Mercado Pago Argentina cobra en pesos: el precio de lista se convierte con la cotización vigente.
    let rate = await latestRate(supabase);
    if (isStale(rate)) {
      await refreshRate(5000);
      rate = (await latestRate(supabase)) ?? rate;
    }
    const ars = arsEquivalent(list, rate);
    if (!list || !ars) return { ok: false, message: "No pudimos calcular el precio en pesos. Probá de nuevo en unos minutos." };
    price = { ...list, currency: "ARS", amount_minor: ars.amountMinor };
  } else if (own) {
    price = own;
  } else {
    return { ok: false, message: "Este producto todavía no tiene precio configurado para ese medio de pago." };
  }
  const base = readPaymentsConfig(process.env).appBaseUrl || canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") }) || publicEnv.siteUrl;

  let url: string;
  try {
    ({ url } = await provider.createCheckout({
      userId: user.id,
      email: user.email ?? "",
      product,
      price,
      successUrl: `${base}/suscripcion?estado=procesando`,
      cancelUrl: `${base}/suscripcion`,
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
