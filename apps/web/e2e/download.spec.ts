import { expect, test } from "@playwright/test";

/** Descargar la app desde la computadora: página pública, pasos del navegador y acceso directo. */
test.describe("descargar la app (computadora)", () => {
  test("página pública con los pasos de la computadora y el acceso directo", async ({ page }) => {
    await page.goto("/descargar");
    await expect(page.getByRole("heading", { name: "Descargá la app" })).toBeVisible();
    await expect(page.getByText("En la computadora")).toBeVisible();
    await expect(page.getByText("Instalar página como aplicación")).toBeVisible(); // Chrome
    const link = page.getByRole("link", { name: /^Descargar acceso directo/ });
    await expect(link).toHaveAttribute("href", /\/acceso-directo\?so=(windows|mac|linux)$/);
    const download = page.waitForEvent("download");
    await link.click();
    expect((await download).suggestedFilename()).toMatch(/RUNNER 360\.(url|webloc)|runner360\.desktop/);
    // Los pasos del celular también están, plegados.
    await page.getByText("Otros dispositivos").click();
    await expect(page.getByText("Agregar a inicio").first()).toBeVisible();
  });

  test("archivo de acceso directo: abre la app en el dominio de producción", async ({ request }) => {
    const win = await request.get("/acceso-directo?so=windows");
    expect(win.headers()["content-disposition"]).toContain('filename="RUNNER 360.url"');
    expect(await win.text()).toMatch(/^\[InternetShortcut\]\r\nURL=https?:\/\/[^/]+\/inicio\r\n/);
    const mac = await request.get("/acceso-directo?so=mac");
    expect(await mac.text()).toContain("<key>URL</key>");
  });

  test("la portada ofrece descargar la app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tené RUNNER 360 a un toque" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Descargá la app" })).toHaveAttribute("href", "/descargar");
  });
});

/** iPhone: dentro de Instagram no se puede instalar; la guía lo dice y ofrece pasar a Safari. */
const IPHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
test.describe("descargar la app (iPhone dentro de Instagram)", () => {
  test.use({ ...IPHONE, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.27.80 (iPhone15,2; iOS 18_6; es_AR)" });
  test("avisa que hay que abrirla en Safari, con botón y enlace para copiar", async ({ page }) => {
    await page.goto("/descargar");
    await expect(page.getByRole("heading", { name: "Primero abrila en Safari" })).toBeVisible();
    await expect(page.getByText("Estás viendo RUNNER 360 dentro de Instagram.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir en Safari" })).toHaveAttribute("href", /^x-safari-https?:\/\/[^/]+\/descargar$/);
    await expect(page.getByRole("button", { name: "Copiar enlace" })).toBeVisible();
    await expect(page.getByText("Abrir en el navegador externo")).toBeVisible();
    await expect(page.getByText("Agregar a inicio").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("descargar la app (iPhone en Safari)", () => {
  test.use({ ...IPHONE, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1" });
  test("pasos de Safari y acceso directo descargable", async ({ page, request }) => {
    await page.goto("/descargar");
    await expect(page.getByRole("heading", { name: "En iPhone o iPad (Safari)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Primero abrila/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Descargar acceso directo (iPhone)" })).toHaveAttribute("href", "/acceso-directo?so=ios");
    const profile = await request.get("/acceso-directo?so=ios");
    expect(profile.headers()["content-type"]).toBe("application/x-apple-aspen-config");
    const body = await profile.text();
    expect(body).toContain("com.apple.webClip.managed");
    expect(body).toMatch(/<string>https?:\/\/[^<]+\/inicio<\/string>/);
  });
});

/** La app instalada redirige seguido (p. ej. /inicio → /ingresar sin sesión): el service worker no debe trabarlo. */
test("con el service worker activo, las redirecciones cargan y sin conexión aparece la página offline", async ({ page, context }) => {
  await page.goto("/descargar");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
  });
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/ingresar/);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await context.setOffline(true);
  await page.goto("/hoy").catch(() => undefined);
  await expect(page.getByText(/sin conexión/i).first()).toBeVisible();
  await context.setOffline(false);
});
