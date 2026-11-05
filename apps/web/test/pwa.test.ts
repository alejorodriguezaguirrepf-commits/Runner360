import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { detectBrowser, detectDesktopOs, detectPlatform, isIosSafari, shortcutFile, shouldShowInstallBanner } from "@/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
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
});
