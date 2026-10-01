"use server";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { getProvider } from "@/lib/payments/registry";
import { ProviderNotConfiguredError } from "@/lib/payments/types";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function startCheckoutAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar?next=/app/suscripcion");
  const provider = getProvider(String(fd.get("provider") ?? ""));
  const priceId = String(fd.get("priceId") ?? "");
  if (!provider) redirect("/app/suscripcion?error=proveedor");
  if (!provider.isConfigured()) redirect("/app/suscripcion?error=pendiente");
  if (!rateLimit(`checkout:${viewer.id}`, 10, 60 * 60_000)) redirect("/app/suscripcion?error=limite");

  const supabase = await createClient();
  // El precio se lee de la base (nunca del formulario) y debe estar activo.
  const { data: price } = await supabase
    .from("subscription_prices")
    .select("id, currency, amount_minor, billing_interval, provider_price_ids, active, subscription_products(id, name, tier)")
    .eq("id", priceId)
    .eq("active", true)
    .maybeSingle();
  if (!price) redirect("/app/suscripcion?error=precio");
  const product = price.subscription_products as unknown as { id: string; name: string; tier: string };
  if (!provider.currencies.includes(price.currency as string)) redirect("/app/suscripcion?error=moneda");

  let url: string;
  try {
    const res = await provider.createCheckout({
      userId: viewer.id,
      email: viewer.email,
      productId: product.id,
      priceId: price.id as string,
      currency: price.currency as string,
      amountMinor: Number(price.amount_minor),
      interval: price.billing_interval as "month" | "year",
      providerPriceId: ((price.provider_price_ids ?? {}) as Record<string, string>)[provider.id] ?? null,
      productName: product.name,
      successUrl: `${publicEnv.siteUrl}/app/suscripcion?checkout=ok`,
      cancelUrl: `${publicEnv.siteUrl}/app/suscripcion?checkout=cancelado`,
    });
    url = res.url;
  } catch (e) {
    console.error(`[checkout:${provider.id}]`, e instanceof Error ? e.message.slice(0, 100) : "");
    redirect(`/app/suscripcion?error=${e instanceof ProviderNotConfiguredError ? "pendiente" : "checkout"}`);
  }
  redirect(url);
}

export async function cancelSubscriptionAction(fd: FormData) {
  const viewer = await getViewer();
  if (!viewer) redirect("/ingresar");
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, provider, provider_subscription_id")
    .eq("id", String(fd.get("subscriptionId") ?? ""))
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (!sub?.provider_subscription_id) redirect("/app/suscripcion?error=cancelacion");
  const provider = getProvider(sub.provider as string);
  if (!provider || !provider.isConfigured()) redirect("/app/suscripcion?error=pendiente");
  try {
    await provider.cancelAtPeriodEnd(sub.provider_subscription_id as string);
  } catch {
    redirect("/app/suscripcion?error=cancelacion");
  }
  // El estado definitivo llega por webhook verificado.
  redirect("/app/suscripcion?cancelacion=solicitada");
}
