/**
 * Limitador de solicitudes en memoria (ventana deslizante simple).
 * Limitación: es por instancia del servidor. En producción con varias instancias usar un
 * almacenamiento compartido (p. ej. Redis/Upstash) — ver docs/SECURITY.md.
 * Supabase Auth además aplica sus propios límites a login, registro y recuperación.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return true;
}
