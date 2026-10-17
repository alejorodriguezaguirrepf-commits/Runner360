import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import { readPaymentsConfig } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { fxSourceUrl, parseFxResponse, type FxQuote } from "./sources";

/** Última cotización válida guardada para la fuente y el tipo configurados. */
export type StoredRate = { rate: number; quotedAt: string; fetchedAt: string; source: string; rateType: string };

/** Pasado este tiempo sin actualizar, la próxima lectura dispara una actualización en segundo plano. */
export const FX_STALE_MS = 26 * 60 * 60 * 1000;

function fxConfig() {
  const c = readPaymentsConfig(process.env);
  return { source: c.fxSource, rateType: c.fxSource === "bcra" ? "mayorista" : c.fxRateType };
}

export async function latestRate(supabase: SupabaseClient | null): Promise<StoredRate | null> {
  if (!supabase) return null;
  const { source, rateType } = fxConfig();
  const { data, error } = await supabase
    .from("fx_rates")
    .select("rate, quoted_at, fetched_at, source, rate_type")
    .eq("source", source)
    .eq("rate_type", rateType)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ rate: number | string; quoted_at: string; fetched_at: string; source: string; rate_type: string }>();
  if (error || !data) return null;
  return { rate: Number(data.rate), quotedAt: data.quoted_at, fetchedAt: data.fetched_at, source: data.source, rateType: data.rate_type };
}

export function isStale(rate: StoredRate | null, now = Date.now()): boolean {
  return !rate || now - Date.parse(rate.fetchedAt) > FX_STALE_MS;
}

/** Consulta la fuente y guarda la cotización. Nunca lanza: si falla, devuelve null y lo registra. */
export async function refreshRate(timeoutMs = 8000): Promise<FxQuote | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { source, rateType } = fxConfig();
  try {
    const res = await fetch(fxSourceUrl(source, rateType), { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`fuente ${source} respondió ${res.status}`);
    const quote = parseFxResponse(source, rateType, await res.json());
    if (!quote) throw new Error(`respuesta de ${source} con formato inesperado`);
    const { error } = await admin.from("fx_rates").insert({ source: quote.source, rate_type: quote.rateType, rate: quote.rate, quoted_at: quote.quotedAt });
    if (error) throw new Error(error.message);
    return quote;
  } catch (e) {
    logError("fx:refresh", e);
    return null;
  }
}
