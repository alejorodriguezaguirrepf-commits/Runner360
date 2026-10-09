import { normalizeBaseUrl } from "./env";

/**
 * Dirección pública a la que deben volver los enlaces de los correos (confirmación de cuenta y
 * recuperación de contraseña). Función pura para poder probarla.
 *
 * Prioridad:
 *  1. El dominio desde el que el usuario hizo la solicitud. Así el enlace vuelve al MISMO dominio
 *     y navegador, que es donde quedó guardada la cookie de verificación del inicio de sesión.
 *  2. NEXT_PUBLIC_SITE_URL (ignorada si apunta a localhost en producción).
 *  3. El dominio de producción que informa Vercel (VERCEL_PROJECT_PRODUCTION_URL).
 *  4. http://localhost:3000 (solo desarrollo).
 *
 * Supabase solo acepta redirecciones incluidas en su lista "Redirect URLs"; si el dominio no está
 * ahí, usa su "Site URL". Por eso un encabezado Host manipulado no permite redirigir a otro sitio.
 */
export function pickSiteUrl(input: {
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
  configured?: string;
  vercelProductionUrl?: string;
  production: boolean;
}): string {
  const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);
  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]?.trim() ?? "";
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    const proto = (input.forwardedProto ?? "").split(",")[0]?.trim() || (localHost ? "http" : "https");
    const fromRequest = normalizeBaseUrl(`${proto === "http" ? "http" : "https"}://${host}`);
    if (fromRequest && !(input.production && isLocal(fromRequest))) return fromRequest;
  }
  const configured = normalizeBaseUrl(input.configured ?? "");
  if (configured && !(input.production && isLocal(configured))) return configured;
  if (input.vercelProductionUrl) return `https://${input.vercelProductionUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
  return configured || "http://localhost:3000";
}
