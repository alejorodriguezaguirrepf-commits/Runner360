/**
 * App instalable (PWA): plataforma, si ya está instalada y cuándo mostrar el aviso. Funciones puras
 * (se prueban en test/pwa.test.ts); el estado del navegador lo leen los componentes de components/pwa.
 */

export type Platform = "ios" | "android" | "desktop";

/** iPhone/iPad (también el iPad que se presenta como Mac), Android o computadora. */
export function detectPlatform(ua: string, maxTouchPoints = 0, platform = ""): Platform {
  if (/iphone|ipad|ipod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

/** Safari en iPhone: es el único navegador de iOS donde "Agregar a inicio" crea la app. */
export function isIosSafari(ua: string): boolean {
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
}

export const DISMISS_KEY = "r360-install-dismissed";
export const INSTALLED_KEY = "r360-installed";

/** El aviso aparece solo en el celular, una vez, y nunca si la app ya está instalada. */
export function shouldShowInstallBanner(s: { platform: Platform; standalone: boolean; dismissed: boolean; installed: boolean }): boolean {
  return s.platform !== "desktop" && !s.standalone && !s.dismissed && !s.installed;
}

/** Evento de Chrome/Android que permite disparar la instalación desde un botón propio. */
export type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
