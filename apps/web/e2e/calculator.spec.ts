import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

test.describe("calculadora de ritmos", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("test → tabla por porcentaje, pasadas, test guardado y planes en km", async ({ page }) => {
    await signUp(page, uniqueEmail("calc"));
    await completeOnboarding(page);
    await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Calculadora" }).click();
    await expect(page.getByRole("heading", { name: "Calculadora de ritmos" })).toBeVisible();

    // a) Test: 2,4 km en 12:00 → 5:00/km.
    await page.getByLabel("Km del test").fill("2,4");
    // Solo se escriben números: los dos puntos se ponen solos.
    await page.getByLabel("Tiempo").pressSequentially("1200");
    await expect(page.getByLabel("Tiempo")).toHaveValue("12:00");
    await expect(page.getByText("Ritmo del test: 5:00 /km.")).toBeVisible();

    // b) Tabla: 400 m al 100 % = 2:00, al 80 % = 2:30, al 50 % = 4:00.
    const table = page.getByRole("region", { name: "Tabla de ritmos por porcentaje" });
    const row = (p: number) => table.getByRole("row", { name: new RegExp(`^${p} %`) });
    const col400 = 3; // %, ritmo, 200 m, 400 m…
    await expect(row(100).getByRole("cell").nth(col400 - 1)).toHaveText("2:00");
    await expect(row(80).getByRole("cell").nth(col400 - 1)).toHaveText("2:30");
    await expect(row(50).getByRole("cell").nth(col400 - 1)).toHaveText("4:00");
    await expect(row(80).getByRole("cell").first()).toHaveText("6:15");
    await expect(table.getByRole("row")).toHaveCount(12);

    // Agregar y quitar distancias.
    await page.getByLabel("Agregar distancia").fill("1,5 km");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(table.getByRole("columnheader", { name: "1,5 km" })).toBeVisible();
    await page.getByRole("button", { name: "Quitar 200 m" }).click();
    await expect(table.getByRole("columnheader", { name: "200 m" })).toHaveCount(0);
    await page.getByLabel("Agregar distancia").fill("10 millas");
    await page.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(page.getByText("Escribí una distancia como 400, 400 m o 5 km.")).toBeVisible();

    // c) Pasadas: 6 × 400 m al 90 % → 2:13 cada una, 5:33 /km.
    await expect(page.getByText("6 × 400 m en 2:13")).toBeVisible();
    await expect(page.getByText("ritmo 5:33 /km").first()).toBeVisible();
    await page.getByRole("button", { name: "Agregar bloque" }).click();
    await expect(page.getByText("4 × 1 km en 5:53")).toBeVisible(); // 300 s / 0,85 = 352,9 s
    await page.getByRole("button", { name: "Quitar bloque 1" }).click();
    await expect(page.getByText("6 × 400 m en 2:13")).toHaveCount(0);

    // d) Se guarda solo y se carga la próxima vez.
    await expect(page.getByText(/Test guardado/)).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByLabel("Km del test")).toHaveValue("2,4");
    await expect(page.getByLabel("Tiempo")).toHaveValue("12:00");

    // Desde 2026.11 los planes ya vienen en km con porcentajes: la nota manda a la Calculadora.
    await page.goto("/planes/plan-07");
    await expect(page.getByText(/Las distancias son las del plan/)).toBeVisible();
    await expect(page.getByText("4 × 1500 m en Umbral (100 %), pausa 2' de trote suave").filter({ visible: true })).toBeVisible();
  });
});
