import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

export interface PublicPrice {
  id: string;
  currency: string;
  amountMinor: number;
  interval: "month" | "year";
}
export interface PublicProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  features: string[];
  prices: PublicPrice[];
}

type PriceRow = { id: string; currency: string; amount_minor: number | string; billing_interval: "month" | "year"; active: boolean };
type ProductRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: "free" | "premium";
  features: string[];
  subscription_prices: PriceRow[] | null;
};

export function mapProducts(rows: ProductRow[]): PublicProduct[] {
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    tier: p.tier,
    features: p.features,
    prices: (p.subscription_prices ?? [])
      .filter((x) => x.active)
      .map((x) => ({ id: x.id, currency: x.currency, amountMinor: Number(x.amount_minor), interval: x.billing_interval })),
  }));
}

/**
 * Catálogo público de productos y precios (administrable desde /admin/productos).
 * Usa la clave pública sin sesión: la política RLS permite leer solo productos y precios activos.
 * Devuelve null si el backend no está configurado o no responde.
 */
export async function getPublicCatalog(): Promise<PublicProduct[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("subscription_products")
      .select("id, code, name, description, tier, features, subscription_prices(id, currency, amount_minor, billing_interval, active)")
      .eq("active", true)
      .order("sort_order");
    if (error) return null;
    return mapProducts((data ?? []) as ProductRow[]);
  } catch {
    return null;
  }
}
