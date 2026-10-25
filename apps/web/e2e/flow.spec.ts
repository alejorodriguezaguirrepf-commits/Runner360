import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

test.describe("flujo vertical con backend", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("registro → onboarding → selector de planes → registro de entrenamiento → progreso", async ({ page }) => {
    await signUp(page, uniqueEmail("flujo"));
    await completeOnboarding(page);
    await expect(page.getByRole("heading", { name: "Planes de entrenamiento" })).toBeVisible();

    // Registro manual con cálculo de ritmo.
    await page.goto("/registrar");
    await page.getByLabel("Distancia (km)").fill("5");
    await page.getByLabel("Duración (mm:ss o h:mm:ss)").fill("30:00");
    await expect(page.getByText("6:00 /km")).toBeVisible();
    await expect(page.getByText("10,0 km/h")).toBeVisible();
    await page.getByLabel("RPE (1–10)").fill("4");
    await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
    await expect(page).toHaveURL(/\/entrenamientos\?guardado=1/);
    await expect(page.getByText("Entrenamiento guardado.")).toBeVisible();
    await expect(page.getByText(/5 km · 30:00 · 6:00 \/km · RPE 4/)).toBeVisible();

    // Dashboard con datos derivados del registro real.
    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: /Corredora E2E/ })).toBeVisible();
    const last30 = page.locator("section", { has: page.getByRole("heading", { name: "Últimos 30 días" }) });
    await expect(last30.getByText("5 km")).toBeVisible();
    await expect(last30.getByText("30 min")).toBeVisible();

    // Progreso con gráficos y tabla accesible.
    await page.goto("/progreso");
    await expect(page.getByRole("heading", { name: "Kilómetros por semana" })).toBeVisible();
    await expect(page.getByRole("group", { name: /Kilómetros por semana/ })).toBeVisible();

    // Validación del servidor: duración inválida.
    await page.goto("/registrar");
    await page.getByLabel("Duración (mm:ss o h:mm:ss)").fill("5:75");
    await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
    await expect(page.getByText("Duración: usá el formato mm:ss o h:mm:ss")).toBeVisible();
  });

  test("un usuario común no accede a administración ni a módulos Premium", async ({ page }) => {
    await signUp(page, uniqueEmail("comun"));
    await completeOnboarding(page);
    // El panel "no existe" para un usuario común (404), tampoco sus secciones.
    for (const path of ["/admin", "/admin/usuarios", "/admin/productos"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    }
    await page.goto("/inicio");
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
    await page.goto("/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toBeVisible();
    // Aprender e Hidratación: sin carteles de revisión pendiente, con un único aviso general al pie.
    const note = "Contenido informativo. No reemplaza la consulta con un profesional de la salud.";
    await expect(page.getByText(note)).toHaveCount(1);
    await expect(page.getByText(/revisión|borrador/i)).toHaveCount(0);
    await page.goto("/aprender");
    await expect(page.getByRole("link", { name: "Qué es el RPE (esfuerzo percibido)" })).toBeVisible();
    await expect(page.getByText(note)).toHaveCount(1);
    await expect(page.getByText(/revisión|borrador/i)).toHaveCount(0);
    await page.getByRole("link", { name: "Qué es el RPE (esfuerzo percibido)" }).click();
    await expect(page.getByText(note)).toHaveCount(1);
    await expect(page.getByText(/revisión|borrador/i)).toHaveCount(0);
    await page.goto("/suscripcion");
    await expect(page.getByText("Pagos pendientes de configuración")).toBeVisible();
  });
});
