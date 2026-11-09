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

/**
 * Navegador interno de otra app (Instagram, Facebook, TikTok…): ahí ni el iPhone ofrece "Agregar a
 * inicio" ni Android "Instalar app", así que primero hay que abrir la página en Safari o Chrome.
 * Devuelve el nombre de la app o "app" si es un navegador interno sin nombre reconocible; null si no.
 */
export type InAppBrowser = "Instagram" | "Facebook" | "Messenger" | "TikTok" | "LinkedIn" | "X" | "Snapchat" | "LINE" | "Threads" | "Google" | "app";
export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/instagram/i.test(ua)) return "Instagram";
  if (/barcelona/i.test(ua)) return "Threads";
  if (/messenger/i.test(ua)) return "Messenger";
  if (/fban|fbav|fb_iab|fbios|fb4a/i.test(ua)) return "Facebook";
  if (/bytedancewebview|musical_ly|tiktok/i.test(ua)) return "TikTok";
  if (/linkedinapp/i.test(ua)) return "LinkedIn";
  if (/twitter/i.test(ua)) return "X";
  if (/snapchat/i.test(ua)) return "Snapchat";
  if (/\bline\//i.test(ua)) return "LINE";
  const ios = /iphone|ipad|ipod/i.test(ua);
  if (ios && /\bgsa\//i.test(ua)) return "Google";
  // Otras apps de iPhone: su navegador no dice "Safari/" (Chrome, Firefox, Edge y Opera sí se identifican).
  if (ios && !/safari\//i.test(ua) && !/crios|fxios|edgios|opios|opt\//i.test(ua)) return "app";
  // Android: las vistas web dentro de una app llevan "; wv)".
  if (/android/i.test(ua) && /;\s*wv\)/i.test(ua)) return "app";
  return null;
}

/** Enlace que abre la página en Safari desde otra app (iOS 17 o más nuevo). */
export function openInSafariHref(url: string): string {
  return `x-safari-${url}`;
}

/** Enlace que abre la página en Chrome desde otra app en Android (si no está, sigue en la misma). */
export function openInChromeHref(url: string): string {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
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

/**
 * Acceso directo descargable para iPhone/iPad: un perfil que solo agrega el ícono de RUNNER 360 a la
 * pantalla de inicio (no cambia ninguna otra configuración y se puede borrar como cualquier ícono).
 * Los identificadores son fijos: si se instala dos veces, reemplaza al anterior en vez de duplicarlo.
 */
export function iosShortcutProfile(siteUrl: string, iconBase64: string): { filename: string; contentType: string; body: string } {
  const site = siteUrl.replace(/\/+$/, "");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>FullScreen</key>
			<true/>
			<key>Icon</key>
			<data>${iconBase64}</data>
			<key>IsRemovable</key>
			<true/>
			<key>Label</key>
			<string>RUNNER 360</string>
			<key>PayloadDisplayName</key>
			<string>RUNNER 360</string>
			<key>PayloadIdentifier</key>
			<string>ar.runner360.acceso-directo.icono</string>
			<key>PayloadType</key>
			<string>com.apple.webClip.managed</string>
			<key>PayloadUUID</key>
			<string>6F1C2B7E-3A54-4D8B-9E21-5C7A0B3D9F14</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>Precomposed</key>
			<true/>
			<key>URL</key>
			<string>${site}/inicio</string>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>Agrega el ícono de RUNNER 360 a tu pantalla de inicio. No cambia ninguna otra configuración del teléfono.</string>
	<key>PayloadDisplayName</key>
	<string>RUNNER 360</string>
	<key>PayloadIdentifier</key>
	<string>ar.runner360.acceso-directo</string>
	<key>PayloadOrganization</key>
	<string>RUNNER 360</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>A8E4D0C2-71B9-4F36-8D5A-2E9C61F0B7A3</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>
`;
  return { filename: "RUNNER 360.mobileconfig", contentType: "application/x-apple-aspen-config", body };
}
