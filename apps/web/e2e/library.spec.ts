import { expect, test, type Page } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

async function newRunner(page: Page, prefix: string) {
  await signUp(page, uniqueEmail(prefix));
  await completeOnboarding(page);
}

test.describe("biblioteca de planes", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("catálogo: distancia → duración → días llega al plan en 3 toques", async ({ page }) => {
    await newRunner(page, "catalogo");
    await page.goto("/planes");
    await expect(page.getByRole("heading", { name: "Planes de entrenamiento" })).toBeVisible();
    await expect(page.getByText("Valores estimados", { exact: false })).toBeVisible();
    await page.getByRole("group", { name: "Distancia" }).getByRole("link", { name: "10 km" }).click();
    // El nivel se elige solo (cada distancia tiene uno).
    await expect(page.getByRole("group", { name: "Nivel" }).getByRole("link", { name: "Intermedio" })).toHaveAttribute("aria-current", "true");
    await page.getByRole("group", { name: "Duración" }).getByRole("link", { name: "6 meses (24 semanas)" }).click();
    await page.getByRole("group", { name: "Días por semana" }).getByRole("link", { name: "4" }).click();
    await expect(page.getByText("1 plan(es)")).toBeVisible();
    await page.getByRole("link", { name: /10 km en 6 meses, 4 días/ }).click();
    await expect(page.getByRole("heading", { name: "10 km en 6 meses, 4 días" })).toBeVisible();
  });

  test("detalle: ficha, avisos, grilla con descansos y semanas Premium bloqueadas", async ({ page }) => {
    await newRunner(page, "detalle");
    await page.goto("/planes/plan-04");
    await expect(page.getByRole("heading", { name: "5 km desde cero en 3 meses, 3 días" })).toBeVisible();
    await expect(page.getByText("Requisitos para empezar")).toBeVisible();
    await expect(page.getByText("Caminar 30' a paso ligero sin molestias (no hace falta saber correr)")).toBeVisible();
    await page.getByText("Ver avisos de seguridad").click();
    await expect(page.getByText(/Suspender de inmediato y buscar atención/)).toBeVisible();

    // Vista rápida: semana 1 visible; las siguientes, solo con Premium.
    const overview = page.getByRole("table", { name: "Vista rápida de todas las semanas" });
    await expect(overview.getByRole("rowheader", { name: "S1", exact: true })).toBeVisible();
    await expect(overview.getByText(/Semanas 2–12: disponibles con Premium/)).toBeVisible();

    // Semana 1 día por día: 7 días, con los descansos visibles y todas las columnas.
    const week = page.locator("#semana");
    await expect(week.getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(week.getByRole("heading", { name: /Lun · Descanso/ })).toBeVisible();
    await expect(week.getByText("Calentamiento").first()).toBeVisible();
    await expect(week.getByText("Vuelta a la calma").first()).toBeVisible();

    await page.goto("/planes/plan-04?semana=2");
    await expect(page.locator("#semana").getByText("La ficha y las primeras semanas son gratis", { exact: false })).toBeVisible();
  });

  test("asistente: recomienda un plan que cumple los requisitos", async ({ page }) => {
    await newRunner(page, "asistente");
    // El perfil precarga 5 km y 3 días disponibles (Mar/Jue/Sáb).
    await expect(page.getByText("Completamos algunas respuestas con tu perfil de corredor")).toBeVisible();
    await page.getByRole("button", { name: "Ver mi plan" }).click();
    await expect(page.getByText("Te recomendamos este plan")).toBeVisible();
    await expect(page.getByText("5 km desde cero en 3 meses, 3 días")).toBeVisible();
    await page.getByRole("link", { name: "Ver el plan completo" }).click();
    await expect(page).toHaveURL(/\/planes\/plan-04/);
  });

  test("asistente: sin requisitos no se puede empezar un plan inadecuado", async ({ page }) => {
    await newRunner(page, "requisitos");
    await page.goto("/planes/elegir?plan=plan-01");
    await expect(page.getByText("Evaluación para el plan 1", { exact: false })).toBeVisible();
    await page.getByLabel("Minutos que podés correr seguidos en Suave, sin dolor").fill("10");
    await page.getByRole("button", { name: "Ver mi plan" }).click();
    // El plan de 1 mes no corresponde: requiere 20' continuos.
    await expect(page.getByText("No cumplís los requisitos").first()).toBeVisible();
    await expect(page.getByText("Correr 20' continuos en Suave sin dolor").first()).toBeVisible();
  });

  test("asistente: lesión activa o consulta médica pendiente no recomiendan plan", async ({ page }) => {
    await newRunner(page, "salud");
    await page.getByLabel("Tengo una lesión activa o dolor al caminar o trotar").check();
    await page.getByRole("button", { name: "Ver mi plan" }).click();
    await expect(page.getByText("Con una lesión activa no corresponde empezar un plan", { exact: false })).toBeVisible();
    await expect(page.getByText("Te recomendamos este plan")).toHaveCount(0);

    await page.getByLabel("Tengo una lesión activa o dolor al caminar o trotar").uncheck();
    await page.getByLabel(/Tengo una enfermedad cardiovascular/).check();
    await page.getByRole("button", { name: "Ver mi plan" }).click();
    await expect(page.getByText("Antes de empezar, hacé una consulta médica", { exact: false })).toBeVisible();
  });

  test("asistente: maratón sin base suficiente queda bloqueado con la indicación del contenido", async ({ page }) => {
    await newRunner(page, "maraton");
    await page.locator("label", { hasText: /^42,195 km$/ }).click();
    await page.getByLabel("Días por semana que podés entrenar").fill("6");
    await page.getByLabel("Km por semana (promedio de las últimas 4–6 semanas)").fill("20");
    await page.getByRole("button", { name: "Ver mi plan" }).click();
    await expect(page.getByText("Hoy no cumplís los requisitos de ingreso", { exact: false })).toBeVisible();
    await expect(page.getByText("Elegir un plan más largo o hacer 3–6 semanas previas en Suave", { exact: false })).toBeVisible();
  });
});
