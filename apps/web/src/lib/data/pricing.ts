import "server-only";
import { formatMoney, type PriceRow, type ProductRow } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PricedProduct extends ProductRow {
  prices: PriceRow[];
  /** Texto de precio de lista (sin proveedor), o null si todavía no se definió. */
  priceLabel: string | null;
}

/** Productos activos con sus precios activos. Devuelve null si la base no está disponible. */
export async function getPricedProducts(supabase: SupabaseClient | null): Promise<PricedProduct[] | null> {
  if (!supabase) return null;
  const [{ data: products, error: e1 }, { data: prices, error: e2 }] = await Promise.all([
    supabase.from("subscription_products").select("*").eq("active", true).order("sort_order"),
    supabase.from("product_prices").select("*").eq("active", true),
  ]);
  if (e1 || e2 || !products) return null;
  return (products as ProductRow[]).map((p) => {
    const own = ((prices ?? []) as PriceRow[]).filter((pr) => pr.product_id === p.id);
    const list = own.find((pr) => pr.provider === null);
    return { ...p, prices: own, priceLabel: list ? formatMoney(list.amount_minor, list.currency) : null };
  });
}
