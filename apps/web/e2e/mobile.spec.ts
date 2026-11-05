import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

test("landing sin desbordes horizontales en móvil", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: "Comenzar gratis" }).first()).toBeVisible();
});

test("navegación inferior en móvil", async ({ page }) => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");
  await signUp(page, uniqueEmail("movil"));
  await completeOnboarding(page);
  const nav = page.getByRole("navigation", { name: "Navegación inferior" });
  await expect(nav).toBeVisible();
  for (const label of ["Inicio", "Plan", "Registrar", "Progreso", "Perfil"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Registrar" }).click();
  await expect(page).toHaveURL(/\/registrar/);
});

test("app instalable: aviso la primera vez en el celular, se cierra y no vuelve; instrucciones de iPhone", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("RUNNER 360");
  expect(manifest.display).toBe("standalone");
  expect((await request.get("/sw.js")).ok()).toBe(true);

  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");
  await signUp(page, uniqueEmail("instalar"));
  await completeOnboarding(page);
  const banner = page.getByRole("complementary", { name: "Instalar la app" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Cerrar el aviso de instalación" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("complementary", { name: "Instalar la app" })).toHaveCount(0);

  await page.goto("/instalar");
  await expect(page.getByRole("heading", { name: "Instalar app" })).toBeVisible();
  // En Android primero van sus pasos; los de iPhone y la computadora, en "Otros dispositivos".
  await expect(page.getByText("Agregar a la pantalla principal").first()).toBeVisible();
  await page.getByText("Otros dispositivos").click();
  await expect(page.getByText("Agregar a inicio").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("descargar la app sin cuenta: pasos del celular primero y sin desbordes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Descargar la app" }).click();
  await expect(page).toHaveURL(/\/descargar$/);
  await expect(page.getByRole("heading", { name: "Descargá la app" })).toBeVisible();
  await expect(page.getByText("En Android (Chrome)")).toBeVisible();
  await expect(page.getByText("Agregar a la pantalla principal").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
