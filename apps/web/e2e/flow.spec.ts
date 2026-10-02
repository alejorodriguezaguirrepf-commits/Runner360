import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

test.describe("flujo vertical con backend", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("registro → onboarding → plan DEMO → calendario → registro de entrenamiento → progreso", async ({ page }) => {
    await signUp(page, uniqueEmail("flujo"));
    await completeOnboarding(page);

    // Propuesta del motor: plan DEMO identificado como tal.
    await expect(page.getByText("Plan recomendado")).toBeVisible();
    await expect(page.getByText("DEMO · 5K Principiante").first()).toBeVisible();
    await expect(page.getByText("DEMO / NO VALIDADO").first()).toBeVisible();
    await page.getByRole("button", { name: "Comenzar este plan" }).click();

    // Calendario generado: 8 semanas x 3 sesiones en Mar/Jue/Sáb.
    await expect(page.getByText("¡Listo! Tu calendario está armado.")).toBeVisible();
    await expect(page.getByText("Plan DEMO / NO VALIDADO")).toBeVisible();
    await expect(page.getByText("Mar · Jue · Sáb")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Semana \d+/ })).toHaveCount(8);

    // Detalle de una sesión con estructura y criterios de suspensión.
    await page.getByRole("link", { name: /Rodaje/ }).first().click();
    await expect(page.getByText("Entrada en calor")).toBeVisible();
    await expect(page.getByText("Cuándo reducir o suspender")).toBeVisible();

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
    await expect(page.getByText("Entrenamiento de hoy")).toBeVisible();
    const last30 = page.locator("section", { has: page.getByRole("heading", { name: "Últimos 30 días" }) });
    await expect(last30.getByText("5 km")).toBeVisible();
    await expect(last30.getByText("30 min")).toBeVisible();

    // Progreso con gráficos y tabla accesible.
    await page.goto("/progreso");
    await expect(page.getByRole("heading", { name: "Kilómetros por semana" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Kilómetros por semana/ })).toBeVisible();

    // Validación del servidor: duración inválida.
    await page.goto("/registrar");
    await page.getByLabel("Duración (mm:ss o h:mm:ss)").fill("5:75");
    await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
    await expect(page.getByText("Duración: usá el formato mm:ss o h:mm:ss")).toBeVisible();
  });

  test("los antecedentes de salud derivan a revisión profesional y no asignan plan", async ({ page }) => {
    await signUp(page, uniqueEmail("salud"));
    await page.getByLabel(/Doy mi consentimiento expreso/).check();
    await page.getByLabel(/Tengo o tuve una lesión/).check();
    await completeOnboarding(page);
    await expect(page.getByText("Te recomendamos una revisión profesional")).toBeVisible();
    await expect(page.getByRole("button", { name: "Comenzar este plan" })).toHaveCount(0);
  });

  test("sin base para 42K sugiere fase introductoria", async ({ page }) => {
    await signUp(page, uniqueEmail("intro"));
    await completeOnboarding(page, { distance: "42K" });
    await expect(page.getByText("Te sugerimos una fase introductoria")).toBeVisible();
  });

  test("un usuario común no accede a administración ni a módulos Premium", async ({ page }) => {
    await signUp(page, uniqueEmail("comun"));
    await completeOnboarding(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/inicio/);
    await page.goto("/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toBeVisible();
    await expect(page.getByText("No existe una cantidad de agua universal", { exact: false })).toBeVisible();
    await page.goto("/suscripcion");
    await expect(page.getByText("Pagos pendientes de configuración")).toBeVisible();
  });
});
