import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

/**
 * Ingreso con huella de punta a punta con un autenticador virtual de Chromium (huella simulada):
 * activar en Perfil, cerrar sesión e ingresar sin contraseña.
 */
test("ingreso con huella: activar en Perfil y entrar sin contraseña", async ({ page, context }) => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });

  await signUp(page, uniqueEmail("huella"));
  await completeOnboarding(page);
  await page.goto("/perfil");
  await page.getByRole("button", { name: "Activar en este dispositivo" }).click();
  await expect(page.getByText("¡Listo! La próxima vez podés ingresar con tu huella")).toBeVisible();
  await expect(page.getByRole("button", { name: /Quitar el ingreso con huella/ })).toBeVisible();

  await context.clearCookies();
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Ingresar con huella o Face ID" }).click();
  await expect(page).toHaveURL(/\/inicio/);
});

test("ingreso con huella: sin llave registrada avisa y no entra", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Ingresar con huella o Face ID" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/ingresar/);
});
