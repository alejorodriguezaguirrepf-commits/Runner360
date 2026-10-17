import type { FxSource } from "@/lib/payments/config";

/**
 * Fuentes públicas de cotización USD→ARS. Las funciones de lectura son puras (testeables) y validan
 * la respuesta: un valor fuera de rango o con formato inesperado se descarta.
 *
 * - dolarapi (por defecto): https://dolarapi.com/v1/dolares/{tipo}. Tipo "oficial" = dólar oficial del
 *   Banco Nación; se usa el valor de VENTA. Otros tipos: blue, bolsa, contadoconliqui, mayorista, tarjeta.
 * - bcra: API de Estadísticas Cambiarias del BCRA (v1.0), cotización de referencia del USD
 *   (tipo de cambio mayorista, Comunicación "A" 3500). FX_RATE_TYPE no aplica.
 */
export type FxQuote = { source: FxSource; rateType: string; rate: number; quotedAt: string };

const MIN_RATE = 1;
const MAX_RATE = 1_000_000;

function validRate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > MIN_RATE && n < MAX_RATE;
}

function validDate(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

export function fxSourceUrl(source: FxSource, rateType: string): string {
  if (source === "bcra") return "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";
  return `https://dolarapi.com/v1/dolares/${encodeURIComponent(rateType)}`;
}

/** dolarapi: { moneda: "USD", casa, nombre, compra, venta, fechaActualizacion }. */
export function parseDolarApi(body: unknown, rateType: string): FxQuote | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.moneda !== undefined && b.moneda !== "USD") return null;
  if (!validRate(b.venta) || !validDate(b.fechaActualizacion)) return null;
  return { source: "dolarapi", rateType, rate: b.venta, quotedAt: new Date(b.fechaActualizacion).toISOString() };
}

type BcraDetalle = { codigoMoneda?: unknown; tipoCotizacion?: unknown };
type BcraResult = { fecha?: unknown; detalle?: BcraDetalle[] };

/**
 * BCRA: { status, results: [{ fecha, detalle: [{ codigoMoneda: "USD", tipoCotizacion }] }] }
 * (con fecha consultada, `results` puede venir como objeto). Se toma la fecha más reciente.
 */
export function parseBcra(body: unknown): FxQuote | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { results?: unknown }).results;
  const results = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as BcraResult[];
  const quotes = results
    .map((r) => {
      const usd = (r.detalle ?? []).find((d) => d.codigoMoneda === "USD");
      return usd && validRate(usd.tipoCotizacion) && validDate(r.fecha)
        ? { rate: usd.tipoCotizacion, quotedAt: new Date(`${String(r.fecha).slice(0, 10)}T12:00:00-03:00`).toISOString() }
        : null;
    })
    .filter((q): q is { rate: number; quotedAt: string } => q !== null)
    .sort((a, b) => b.quotedAt.localeCompare(a.quotedAt));
  const latest = quotes[0];
  return latest ? { source: "bcra", rateType: "mayorista", ...latest } : null;
}

export function parseFxResponse(source: FxSource, rateType: string, body: unknown): FxQuote | null {
  return source === "bcra" ? parseBcra(body) : parseDolarApi(body, rateType);
}
