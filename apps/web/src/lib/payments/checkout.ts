import "server-only";
import type { PriceRow, ProductRow } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { arsEquivalent } from "@/lib/data/pricing";
import { publicEnv, readEnv } from "@/lib/env";
import { isStale, latestRate, refreshRate } from "@/lib/fx/rates";
import { logError } from "@/lib/log";
import { readPaymentsConfig } from "@/lib/payments/config";
import { getProvider } from "@/lib/payments/registry";
import { canonicalSiteUrl } from "@/lib/site-url";

/** Dirección pública de la app para las URLs de vuelta del pago. */
export function siteBase(): string {
  return readPaymentsConfig(process.env).appBaseUrl || canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") }) || publicEnv.siteUrl;
}

/**
 * Arma el pago de una suscripción y devuelve la URL del medio de pago (o el motivo por el que no se
 * puede). Aplica las reglas de compra. La usan la pantalla de Suscripción (con la sesión) y el link de
 * pago de los correos (con la conexión de servicio).
 */
export async function createCheckoutUrl(
  db: SupabaseClient,
  req: { userId: string; email: string; productId: string; provider: "mercadopago" | "stripe"; successUrl: string; cancelUrl: string },
): Promise<{ url: string } | { error: string }> {
  const provider = getProvider(req.provider);
  if (!provider || !provider.isConfigured()) {
    return { error: `${provider?.label ?? "El medio de pago"} está pendiente de configuración. Todavía no se pueden procesar pagos.` };
  }
  const [{ data: product }, { data: prices }] = await Promise.all([
    db.from("subscription_products").select("*").eq("id", req.productId).eq("active", true).maybeSingle<ProductRow>(),
    db.from("product_prices").select("*").eq("product_id", req.productId).eq("active", true),
  ]);
  const active = (prices ?? []) as PriceRow[];
  const own = active.find((pr) => pr.provider === req.provider);
  const list = active.find((pr) => pr.provider === null) ?? null;
  if (!product || product.tier !== "premium" || (!own && !list)) return { error: "Este producto todavía no tiene precio configurado para ese medio de pago." };
  // Reglas de compra (también se validan acá, no solo en la pantalla).
  const [{ data: premium }, { data: annualUntil }] = await Promise.all([
    db.rpc("has_premium", { p_user: req.userId }),
    db.rpc("annual_access_until", { p_user: req.userId }),
  ]);
  if (product.billing_interval === "year") {
    if (req.provider !== "mercadopago") return { error: "El plan anual se paga con Mercado Pago." };
    if (premium === true && !annualUntil) return { error: "Para pasar al anual, primero cancelá la renovación mensual y esperá a que termine el mes pago." };
  } else if (premium === true) {
    return { error: "Ya tenés una suscripción activa." };
  }

  let price: PriceRow;
  if (req.provider === "mercadopago") {
    // Mercado Pago Argentina cobra en pesos: un precio de lista en pesos se cobra tal cual; uno en otra
    // moneda se convierte con la cotización vigente.
    let rate = list?.currency === "ARS" ? null : await latestRate(db);
    if (list?.currency !== "ARS" && isStale(rate)) {
      await refreshRate(5000);
      rate = (await latestRate(db)) ?? rate;
    }
    const ars = arsEquivalent(list, rate);
    if (!list || !ars) return { error: "No pudimos calcular el precio en pesos. Probá de nuevo en unos minutos." };
    price = { ...list, currency: "ARS", amount_minor: ars.amountMinor };
  } else if (own) {
    price = own;
  } else {
    return { error: "Este producto todavía no tiene precio configurado para ese medio de pago." };
  }
  try {
    return await provider.createCheckout({ userId: req.userId, email: req.email, product, price, successUrl: req.successUrl, cancelUrl: req.cancelUrl });
  } catch (e) {
    logError("checkout", e);
    return { error: "No pudimos iniciar el pago. Probá más tarde." };
  }
}
