import { createHash, timingSafeEqual } from "node:crypto";

/** ¿El encabezado Authorization es "Bearer <secreto>"? Comparación en tiempo constante; sin secreto, siempre no. */
export function isCronAuthorized(header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const digest = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
