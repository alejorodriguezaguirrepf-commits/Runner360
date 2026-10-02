import { expect, type Page } from "@playwright/test";

export const backendConfigured = Boolean(process.env.E2E_WITH_BACKEND);

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function signUp(page: Page, email: string, name = "Corredora E2E"): Promise<void> {
  await page.goto("/registro");
  await page.getByLabel("Nombre visible").fill(name);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill("claveSegura123");
  await page.getByLabel(/Acepto los/).check();
  await page.getByRole("button", { name: "Comenzar gratis" }).click();
  // Con confirmación de correo desactivada (entorno local) se ingresa directo al onboarding.
  await expect(page).toHaveURL(/\/onboarding/);
}

export async function completeOnboarding(page: Page, opts: { distance?: string; level?: string; weeklyKm?: string; days?: string[] } = {}): Promise<void> {
  await page.getByLabel("Fecha de nacimiento").fill("1990-05-10");
  await page.getByLabel("Distancia objetivo").selectOption(opts.distance ?? "5K");
  await page.getByLabel("Objetivo", { exact: true }).selectOption("complete");
  await page.getByLabel("Nivel").selectOption(opts.level ?? "beginner");
  await page.getByLabel("Experiencia corriendo").selectOption("none");
  await page.getByLabel("Kilómetros semanales actuales").fill(opts.weeklyKm ?? "0");
  for (const d of opts.days ?? ["Martes", "Jueves", "Sábado"]) {
    await page.locator("label", { hasText: new RegExp(`^${d}$`) }).click();
  }
  await page.getByRole("button", { name: "Guardar y ver mi plan" }).click();
  await expect(page).toHaveURL(/\/plan/);
}
