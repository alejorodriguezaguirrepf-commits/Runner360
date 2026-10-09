import "server-only";
import { publicEnv } from "@/lib/env";

/**
 * Limitador de solicitudes en memoria (ventana fija). Suficiente para un único proceso.
 * En despliegues con varias instancias reemplazar por un almacenamiento compartido (Redis/Upstash
 * o una tabla en Postgres). Ver docs/SECURITY.md.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Solo para pruebas E2E contra un backend local (nunca se respeta con un Supabase remoto). */
const disabledForLocalTests =
  process.env.DISABLE_RATE_LIMIT === "1" && /^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(publicEnv.supabaseUrl);

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterS: number } {
  if (disabledForLocalTests) return { ok: true, retryAfterS: 0 };
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterS: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfterS: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfterS: 0 };
}

export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
