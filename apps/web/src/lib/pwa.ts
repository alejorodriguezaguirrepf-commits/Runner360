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

export type Browser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "other";

/** Navegador, para mostrar los pasos que corresponden (Edge y Samsung antes que Chrome: lo incluyen en su nombre). */
export function detectBrowser(ua: string): Browser {
  if (/edg(e|a|ios)?\//i.test(ua)) return "edge";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/chrome|crios|chromium/i.test(ua)) return "chrome";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

export type DesktopOs = "windows" | "mac" | "linux";

export function detectDesktopOs(ua: string, platform = ""): DesktopOs {
  if (/mac/i.test(platform) || /macintosh|mac os x/i.test(ua)) return "mac";
  if (/win/i.test(platform) || /windows/i.test(ua)) return "windows";
  return "linux";
}

export function isDesktopOs(v: string | null | undefined): v is DesktopOs {
  return v === "windows" || v === "mac" || v === "linux";
}

/**
 * Archivo de acceso directo para la computadora (sirve en cualquier navegador, también Firefox):
 * .url en Windows, .webloc en Mac y .desktop en Linux. Al abrirlo se entra a la app.
 */
export function shortcutFile(os: DesktopOs, siteUrl: string): { filename: string; contentType: string; body: string } {
  const site = siteUrl.replace(/\/+$/, "");
  const url = `${site}/inicio`;
  if (os === "windows") {
    return { filename: "RUNNER 360.url", contentType: "application/internet-shortcut", body: `[InternetShortcut]\r\nURL=${url}\r\nIconFile=${site}/favicon.ico\r\nIconIndex=0\r\n` };
  }
  if (os === "mac") {
    return {
      filename: "RUNNER 360.webloc",
      contentType: "application/x-apple-plist",
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>URL</key>\n\t<string>${url}</string>\n</dict>\n</plist>\n`,
    };
  }
  return { filename: "runner360.desktop", contentType: "application/x-desktop", body: `[Desktop Entry]\nType=Link\nName=RUNNER 360\nURL=${url}\nIcon=${site}/icons/icon-192.png\n` };
}
