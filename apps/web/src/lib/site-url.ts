import { normalizeBaseUrl } from "./env";

const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u);

/**
 * Dominio público de producción: NEXT_PUBLIC_SITE_URL (si no es localhost) o el dominio de
 * producción que informa Vercel (VERCEL_PROJECT_PRODUCTION_URL). Nunca un link de preview ni la
 * dirección propia de un deploy, que Vercel protege y piden iniciar sesión en Vercel.
 */
export function canonicalSiteUrl(input: { configured?: string; vercelProductionUrl?: string }): string {
  const configured = normalizeBaseUrl(input.configured ?? "");
  if (configured && !isLocal(configured)) return configured;
  const vercel = (input.vercelProductionUrl ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return vercel ? normalizeBaseUrl(`https://${vercel}`) : "";
}

/**
 * Dirección pública a la que deben volver los enlaces de los correos (recuperación de contraseña).
 * Función pura para poder probarla.
 *
 * Prioridad:
 *  1. En producción, el dominio de producción (canonicalSiteUrl). Así un registro hecho desde un
 *     link de preview no manda a la persona de vuelta a una página protegida por Vercel.
 *  2. El dominio desde el que el usuario hizo la solicitud (desarrollo y pruebas locales).
 *  3. NEXT_PUBLIC_SITE_URL o http://localhost:3000.
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
  if (input.production) {
    const canonical = canonicalSiteUrl(input);
    if (canonical) return canonical;
  }
  const host = (input.forwardedHost ?? input.host ?? "").split(",")[0]?.trim() ?? "";
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
    const proto = (input.forwardedProto ?? "").split(",")[0]?.trim() || (localHost ? "http" : "https");
    const fromRequest = normalizeBaseUrl(`${proto === "http" ? "http" : "https"}://${host}`);
    if (fromRequest && !(input.production && isLocal(fromRequest))) return fromRequest;
  }
  const configured = normalizeBaseUrl(input.configured ?? "");
  return configured || "http://localhost:3000";
}

/**
 * Producción en Vercel: si se entra por otra dirección (el dominio viejo runner360.vercel.app, www o
 * la dirección propia de un deploy) se redirige al dominio de producción conservando ruta y
 * parámetros. Devuelve la URL de destino o null.
 * Quedan sin redirigir: /api (webhooks de Mercado Pago y la app móvil, que no siguen redirecciones)
 * y /auth (enlaces de correo ya enviados y el traspaso de sesión, que se resuelven en el dominio viejo).
 */
export function canonicalRedirect(input: { url: string; host: string | null; vercelEnv?: string; canonical: string }): string | null {
  if (input.vercelEnv !== "production" || !input.canonical || !input.host) return null;
  const target = new URL(input.canonical);
  if (input.host.toLowerCase() === target.host) return null;
  const u = new URL(input.url);
  if (u.pathname.startsWith("/api/") || u.pathname.startsWith("/auth/")) return null;
  return `${target.origin}${u.pathname}${u.search}`;
}

/** Cookie de sesión de Supabase (puede venir partida en .0, .1…). */
export const hasSessionCookie = (names: readonly string[]) => names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n));

/** Ruta interna (relativa y del mismo sitio) o null. Evita redirecciones abiertas. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  return raw;
}

/**
 * Traspaso de sesión al dominio nuevo: quien ya había iniciado sesión en el dominio viejo pasa por
 * /auth/traspaso (en el dominio viejo), que genera un enlace de un solo uso y lo abre en el dominio
 * nuevo. Así no tiene que volver a ingresar. Solo para pedidos GET de páginas.
 */
export function sessionHandoffPath(input: { redirectTo: string | null; hasSession: boolean; method: string }): string | null {
  if (!input.redirectTo || !input.hasSession || input.method !== "GET") return null;
  const u = new URL(input.redirectTo);
  return `/auth/traspaso?next=${encodeURIComponent(`${u.pathname}${u.search}`)}`;
}
