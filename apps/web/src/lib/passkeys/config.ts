/**
 * Ingreso con huella / Face ID (llaves de acceso, WebAuthn): reglas puras, sin acceso a la base
 * (se prueban en test/passkeys.test.ts).
 */
import { detectBrowser, detectDesktopOs, detectPlatform } from "@/lib/pwa";

/** Llaves por cuenta (un celular, una compu, una tablet… con margen). */
export const MAX_PASSKEYS = 10;
/** Cookie con el id del desafío en curso (solo el servidor la lee; dura lo mismo que el desafío). */
export const CHALLENGE_COOKIE = "r360-pk";
export const CHALLENGE_TTL_S = 300;

/**
 * Sitio al que pertenecen las llaves: el dominio de producción (runner360.ar). Una llave creada en
 * un dominio solo sirve en ese dominio; los demás dominios ya redirigen a este.
 */
export function relyingParty(siteUrl: string): { rpID: string; origin: string } {
  const u = new URL(siteUrl);
  return { rpID: u.hostname, origin: u.origin };
}

/** Nombre del dispositivo para la lista del perfil, p. ej. "iPhone (Safari)" o "Windows (Chrome)". */
export function deviceName(ua: string): string {
  const platform = detectPlatform(ua);
  const browser = detectBrowser(ua);
  const browserLabel = { safari: "Safari", chrome: "Chrome", edge: "Edge", firefox: "Firefox", samsung: "Samsung Internet", other: "" }[browser];
  let device: string;
  if (platform === "ios") device = /ipad/i.test(ua) ? "iPad" : "iPhone";
  else if (platform === "android") device = "Android";
  else device = { windows: "Windows", mac: "Mac", linux: "Linux" }[detectDesktopOs(ua)];
  return browserLabel ? `${device} (${browserLabel})` : device;
}

/** El identificador de la cuenta que guarda la llave (no es un dato personal: es el id interno). */
export function userHandle(userId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(userId);
}
