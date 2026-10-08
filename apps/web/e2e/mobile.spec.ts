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
