import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { detectBrowser, detectDesktopOs, detectInAppBrowser, detectPlatform, iosShortcutProfile, isIosSafari, openInChromeHref, openInSafariHref, shortcutFile, shouldShowInstallBanner } from "@/lib/pwa";
import { APPLE_ICON_BASE64 } from "@/lib/pwa-icon";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.27.80 (iPhone15,2; iOS 18_6; es_AR; es; scale=3.00; 1179x2556; 712345678)";
const IPHONE_FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.40.100;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBID/phone;FBLC/es_LA;FBOP/5]";
const IPHONE_WEBVIEW = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID_INSTAGRAM = "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Instagram 400.0.0.27.80 Android";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("app instalable", () => {
  it("detecta la plataforma (incluido el iPad que se presenta como Mac)", () => {
    expect(detectPlatform(IPHONE)).toBe("ios");
    expect(detectPlatform(ANDROID)).toBe("android");
    expect(detectPlatform(MAC, 0, "MacIntel")).toBe("desktop");
    expect(detectPlatform(MAC, 5, "MacIntel")).toBe("ios");
    expect(isIosSafari(IPHONE)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
  });

  it("el aviso aparece solo en el celular, una vez y si la app no está instalada", () => {
    const base = { platform: "android" as const, standalone: false, dismissed: false, installed: false };
    expect(shouldShowInstallBanner(base)).toBe(true);
    expect(shouldShowInstallBanner({ ...base, platform: "ios" })).toBe(true);
    expect(shouldShowInstallBanner({ ...base, platform: "desktop" })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, standalone: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, installed: true })).toBe(false);
    expect(shouldShowInstallBanner({ ...base, dismissed: true })).toBe(false);
  });

  it("manifest instalable: nombre, inicio, pantalla completa e íconos 192/512 normales y adaptables", () => {
    const m = manifest();
    expect(m.name).toBe("RUNNER 360");
    expect(m.start_url).toBe("/inicio");
    expect(m.display).toBe("standalone");
    const icons = m.icons ?? [];
    for (const size of ["192x192", "512x512"]) {
      expect(icons.some((i) => i.sizes === size && i.purpose === "any")).toBe(true);
      expect(icons.some((i) => i.sizes === size && i.purpose === "maskable")).toBe(true);
    }
    for (const i of icons) expect(existsSync(join("public", i.src)), i.src).toBe(true);
    expect(existsSync(join("public", "sw.js"))).toBe(true);
    expect(existsSync(join("public", "offline.html"))).toBe(true);
  });
});

describe("descargar la app en la computadora", () => {
  const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const WIN_EDGE = `${WIN_CHROME} Edg/130.0.0.0`;
  const LINUX_FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
  it("detecta el navegador y el sistema", () => {
    expect(detectBrowser(WIN_CHROME)).toBe("chrome");
    expect(detectBrowser(WIN_EDGE)).toBe("edge");
    expect(detectBrowser(LINUX_FIREFOX)).toBe("firefox");
    expect(detectBrowser(MAC)).toBe("safari");
    expect(detectBrowser(IPHONE_CHROME)).toBe("chrome");
    expect(detectDesktopOs(WIN_CHROME)).toBe("windows");
    expect(detectDesktopOs(MAC)).toBe("mac");
    expect(detectDesktopOs(LINUX_FIREFOX)).toBe("linux");
  });
  it("acceso directo para cada sistema, al inicio de la app en el dominio dado", () => {
    const win = shortcutFile("windows", "https://runner360.ar/");
    expect(win.filename).toBe("RUNNER 360.url");
    expect(win.body).toContain("URL=https://runner360.ar/inicio\r\n");
    expect(shortcutFile("mac", "https://runner360.ar").body).toContain("<string>https://runner360.ar/inicio</string>");
    expect(shortcutFile("linux", "https://runner360.ar").body).toContain("URL=https://runner360.ar/inicio");
  });

  it("detecta el navegador interno de otras apps, donde no se puede instalar", () => {
    expect(detectInAppBrowser(IPHONE_INSTAGRAM)).toBe("Instagram");
    expect(detectInAppBrowser(IPHONE_FACEBOOK)).toBe("Facebook");
    expect(detectInAppBrowser(ANDROID_INSTAGRAM)).toBe("Instagram");
    expect(detectInAppBrowser(IPHONE_WEBVIEW)).toBe("app");
    expect(detectInAppBrowser(ANDROID_WEBVIEW)).toBe("app");
    // Safari, Chrome y la computadora no son navegadores internos.
    expect(detectInAppBrowser(IPHONE)).toBeNull();
    expect(detectInAppBrowser(IPHONE_CHROME)).toBeNull();
    expect(detectInAppBrowser(ANDROID)).toBeNull();
    expect(detectInAppBrowser(MAC)).toBeNull();
  });

  it("enlaces para pasar a Safari o a Chrome", () => {
    expect(openInSafariHref("https://runner360.ar/instalar")).toBe("x-safari-https://runner360.ar/instalar");
    expect(openInChromeHref("https://runner360.ar/descargar?x=1")).toBe(
      "intent://runner360.ar/descargar?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Frunner360.ar%2Fdescargar%3Fx%3D1;end",
    );
  });

  it("acceso directo de iPhone: agrega solo el ícono que abre /inicio", () => {
    const p = iosShortcutProfile("https://runner360.ar/", APPLE_ICON_BASE64);
    expect(p.contentType).toBe("application/x-apple-aspen-config");
    expect(p.body).toContain("<string>com.apple.webClip.managed</string>");
    expect(p.body).toContain("<string>https://runner360.ar/inicio</string>");
    expect(p.body).toContain("<key>IsRemovable</key>\n\t\t\t<true/>");
    expect(p.body).toContain(`<data>${APPLE_ICON_BASE64}</data>`);
    // Un único bloque, sin otras configuraciones del teléfono.
    expect(p.body.match(/<key>PayloadType<\/key>/g)).toHaveLength(2);
  });

  it("el ícono del acceso directo de iPhone es el mismo que el de la app", () => {
    const file = readFileSync(join(__dirname, "../src/app/apple-icon.png")).toString("base64");
    expect(APPLE_ICON_BASE64).toBe(file);
  });
});
