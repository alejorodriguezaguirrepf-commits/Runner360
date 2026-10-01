import { expect, test } from "@playwright/test";

test.describe("Sitio público", () => {
  test("landing con hero, CTA y secciones requeridas", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Tu próximo objetivo empieza con un plan." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Comenzar gratis" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Conocer los planes" })).toBeVisible();
    for (const h of ["Cómo funciona", "Distancias disponibles", "Funciones principales", "Beneficios del seguimiento", "Planes y precios", "Preguntas frecuentes"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText("Beta · producto en desarrollo")).toBeVisible();
    await expect(page.getByRole("link", { name: /Política de privacidad/ })).toBeVisible();
  });

  test("sin desbordamiento horizontal", async ({ page }) => {
    for (const path of ["/", "/calculadora", "/ingresar", "/registro", "/privacidad"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `overflow en ${path}`).toBeLessThanOrEqual(1);
    }
  });

  test("calculadora de ritmo y parciales", async ({ page }) => {
    await page.goto("/calculadora");
    await page.getByRole("combobox", { name: "Distancia (km)" }).fill("10");
    await page.getByRole("textbox", { name: "Tiempo objetivo" }).fill("50:00");
    await expect(page.getByTestId("calc-pace")).toHaveText("5:00 /km");
    await expect(page.getByTestId("calc-time")).toHaveText("50:00");
    await expect(page.getByRole("row")).toHaveCount(11);
    await page.getByRole("textbox", { name: "Tiempo objetivo" }).fill("abc");
    await expect(page.getByText("Ingresá el tiempo como mm:ss o h:mm:ss.")).toBeVisible();
    await page.getByRole("radio", { name: "Tiempo final a un ritmo" }).check({ force: true });
    await page.getByRole("combobox", { name: "Distancia (km)" }).fill("42,195");
    await page.getByRole("textbox", { name: "Ritmo (min/km)" }).fill("5:41");
    await expect(page.getByTestId("calc-time")).toHaveText("3:59:48");
  });

  test("navegación por teclado: enlace para saltar al contenido", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
  });

  test("documentos legales marcados como borrador", async ({ page }) => {
    await page.goto("/terminos");
    await expect(page.getByText("Borrador sujeto a revisión legal")).toBeVisible();
    await page.goto("/privacidad");
    await expect(page.getByText(/Ley 25.326/).first()).toBeVisible();
  });
});

test.describe("Protección de rutas sin backend configurado", () => {
  for (const path of ["/app", "/app/plan", "/admin", "/onboarding"]) {
    test(`${path} redirige a ingresar`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/ingresar\?motivo=configuracion/);
      await expect(page.getByText("Autenticación pendiente de configuración")).toBeVisible();
      await expect(page.getByRole("button", { name: "Ingresar" })).toBeDisabled();
    });
  }

  test("APIs informan configuración pendiente", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(await health.json()).toMatchObject({ supabase: "pending", payments: { mercadopago: "pending", stripe: "pending" } });
    expect((await request.post("/api/webhooks/stripe", { data: "{}" })).status()).toBe(503);
    expect((await request.post("/api/webhooks/desconocido", { data: "{}" })).status()).toBe(404);
    expect((await request.post("/api/iap/verify")).status()).toBe(501);
    expect((await request.get("/api/me/export")).status()).toBe(503);
  });
});
