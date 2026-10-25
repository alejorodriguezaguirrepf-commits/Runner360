import "server-only";
import { readEnv } from "@/lib/env";

/**
 * Captcha invisible contra registros automáticos (Cloudflare Turnstile). El formulario de registro
 * obtiene un token en el navegador y el servidor lo verifica antes de crear la cuenta.
 * Sin TURNSTILE_SECRET_KEY la verificación se omite (entorno local o claves todavía sin cargar).
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSecret(): string {
  return readEnv("TURNSTILE_SECRET_KEY");
}

/** Clave pública del widget (la lee el servidor y se la pasa al formulario). */
export function turnstileSiteKey(): string {
  return readEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}

export type TurnstileResult = { ok: true; skipped: boolean } | { ok: false; reason: "missing" | "rejected" | "unavailable" };

export async function verifyTurnstile(
  token: unknown,
  remoteIp: string | null,
  { secret = turnstileSecret(), fetchImpl = fetch }: { secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<TurnstileResult> {
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== "string" || !token) return { ok: false, reason: "missing" };
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true, skipped: false } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
