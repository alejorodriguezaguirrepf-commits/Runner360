/**
 * Sugerencia para errores de tipeo en el dominio del correo ("gmial.com" → "gmail.com").
 * Solo sugiere: nunca cambia el correo sin que la persona lo acepte.
 */
export const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.ar",
  "outlook.com",
  "outlook.com.ar",
  "live.com",
  "live.com.ar",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
  "me.com",
  "protonmail.com",
  "proton.me",
  "fibertel.com.ar",
  "speedy.com.ar",
  "arnet.com.ar",
] as const;

/** Distancia de edición (inserción, borrado, reemplazo y transposición de letras vecinas). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
}

/** Correo corregido si el dominio se parece mucho a uno común (distancia 1–2), o null. */
export function suggestEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if ((COMMON_EMAIL_DOMAINS as readonly string[]).includes(domain)) return null;
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const distance = editDistance(domain, candidate);
    const limit = candidate.length > 6 ? 2 : 1;
    if (distance <= limit && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}
