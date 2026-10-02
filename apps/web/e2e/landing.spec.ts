import { expect, test } from "@playwright/test";

test.describe("landing", () => {
  test("muestra la propuesta comercial en español y sin testimonios inventados", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Tu próximo objetivo empieza con un plan." })).toBeVisible();
    await expect(page.getByText("Entrená para tus primeros 5K, mejorá tus marcas o prepará tu próxima maratón con un plan adaptado a vos.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Comenzar gratis" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Conocer los planes" })).toBeVisible();
    await expect(page.getByText("Beta en desarrollo")).toBeVisible();
    for (const id of ["como-funciona", "distancias", "precios", "preguntas"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.getByRole("link", { name: "Política de privacidad" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es-AR");
  });

  test("las rutas privadas redirigen al ingreso", async ({ page }) => {
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test("los documentos legales se identifican como borradores", async ({ page }) => {
    await page.goto("/privacidad");
    await expect(page.getByText("Borrador sujeto a revisión legal")).toBeVisible();
  });
});
