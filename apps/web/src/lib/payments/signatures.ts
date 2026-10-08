import { createHmac, timingSafeEqual } from "node:crypto";

/** Verificación de firmas de webhooks. Funciones puras (testeables) con comparación en tiempo constante. */

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Stripe: encabezado `Stripe-Signature: t=<ts>,v1=<firma>[,v1=...]`.
 * Firma = HMAC-SHA256(secret, `${t}.${payload}`). Se rechazan firmas fuera de la tolerancia (replay).
 */
export function verifyStripeSignature(params: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceS?: number;
  nowS?: number;
}): boolean {
  const { payload, header, secret } = params;
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return false;
  const now = params.nowS ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > (params.toleranceS ?? 300)) return false;
  const expected = hmacHex(secret, `${t}.${payload}`);
  return signatures.some((s) => safeEqualHex(s, expected));
}

/**
 * Mercado Pago: encabezados `x-signature: ts=<ts>,v1=<firma>` y `x-request-id`.
 * Manifiesto = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (se omiten las partes ausentes).
 * data.id alfanumérico se usa en minúsculas, según la documentación del proveedor.
 */
export function verifyMercadoPagoSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
  toleranceS?: number;
  nowS?: number;
}): boolean {
  const { xSignature, xRequestId, secret } = params;
  if (!xSignature || !secret) return false;
  const parts = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=").map((x) => x.trim()) as [string, string]));
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^\d+$/.test(ts)) return false;
  if (params.toleranceS !== undefined) {
    const now = params.nowS ?? Math.floor(Date.now() / 1000);
    const tsS = ts.length > 10 ? Math.floor(Number(ts) / 1000) : Number(ts);
    if (Math.abs(now - tsS) > params.toleranceS) return false;
  }
  const dataId = params.dataId && /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;
  return safeEqualHex(v1, hmacHex(secret, manifest));
}
