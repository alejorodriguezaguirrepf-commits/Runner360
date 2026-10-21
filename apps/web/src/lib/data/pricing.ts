import "server-only";
import { formatDate, type PriceRow, type ProductRow } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { fmt } from "@/i18n";
import { pricing as m } from "@/i18n/es-AR/pricing";
import { isStale, latestRate, refreshRate, type StoredRate } from "@/lib/fx/rates";
import { arsMinorFromUsd, formatArs, formatListPrice } from "@/lib/money";
import { annualSavings } from "@/lib/payments/annual";

export interface PricedProduct extends ProductRow {
  prices: PriceRow[];
  /** Precio de lista (sin proveedor): la única fuente del importe. */
  listPrice: PriceRow | null;
  /** Texto del precio de lista ("US$ 20"), o null si todavía no se definió. */
  priceLabel: string | null;
  /** Equivalente aproximado en pesos, o null si no hay cotización válida (se oculta). */
  ars: { amountMinor: number; label: string; rateNote: string } | null;
  /** Anual: ahorro frente a 12 meses de la mensual ("US$ 60", 25 %), o null. */
  savings: { label: string; pct: number } | null;
}

/** Equivalente en pesos de un precio de lista con la cotización guardada (null si no aplica). */
export function arsEquivalent(price: PriceRow | null, rate: StoredRate | null): PricedProduct["ars"] {
  if (!price) return null;
  if (price.currency === "ARS") return { amountMinor: price.amount_minor, label: formatArs(price.amount_minor), rateNote: "" };
  if (price.currency !== "USD" || !rate) return null;
  const amountMinor = arsMinorFromUsd(price.amount_minor, rate.rate);
  const type = m.rateTypes[rate.rateType] ?? rate.rateType;
  return { amountMinor, label: formatArs(amountMinor), rateNote: fmt(m.rateNote, { type, date: formatDate(rate.quotedAt.slice(0, 10), "long") }) };
}

/**
 * Productos activos con su precio de lista y el equivalente en pesos. Si la cotización está vieja,
 * se pide una nueva después de responder (nunca demora la página). Devuelve null si la base no está disponible.
 */
export async function getPricedProducts(supabase: SupabaseClient | null): Promise<PricedProduct[] | null> {
  if (!supabase) return null;
  const [{ data: products, error: e1 }, { data: prices, error: e2 }, rate] = await Promise.all([
    supabase.from("subscription_products").select("*").eq("active", true).order("sort_order"),
    supabase.from("product_prices").select("*").eq("active", true),
    latestRate(supabase),
  ]);
  if (e1 || e2 || !products) return null;
  if (isStale(rate)) after(() => refreshRate().then(() => undefined));
  const listOf = (p: ProductRow) => ((prices ?? []) as PriceRow[]).find((pr) => pr.product_id === p.id && pr.provider === null) ?? null;
  const monthly = (products as ProductRow[]).find((p) => p.tier === "premium" && p.billing_interval === "month");
  const monthlyList = monthly ? listOf(monthly) : null;
  return (products as ProductRow[]).map((p) => {
    const own = ((prices ?? []) as PriceRow[]).filter((pr) => pr.product_id === p.id);
    const list = listOf(p);
    const save = p.billing_interval === "year" && list && monthlyList?.currency === list.currency ? annualSavings(monthlyList.amount_minor, list.amount_minor) : null;
    return {
      ...p,
      prices: own,
      listPrice: list,
      priceLabel: list ? formatListPrice(list.amount_minor, list.currency) : null,
      ars: arsEquivalent(list, rate),
      savings: save && list ? { label: formatListPrice(save.amountMinor, list.currency), pct: save.pct } : null,
    };
  });
}

/**
 * ¿Se puede pagar este producto con el proveedor? Mercado Pago cobra el precio de lista convertido a
 * pesos; los demás proveedores necesitan su propio precio configurado.
 */
export function checkoutAvailable(product: PricedProduct, provider: string): boolean {
  if (provider === "mercadopago") return product.listPrice !== null && (product.listPrice.currency === "ARS" || product.listPrice.currency === "USD");
  return product.prices.some((pr) => pr.provider === provider);
}
