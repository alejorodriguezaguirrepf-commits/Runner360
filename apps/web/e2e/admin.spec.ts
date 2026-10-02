import { expect, test, type Page } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

/** Promueve un usuario a administrador usando la clave de servicio (solo entorno local de pruebas). */
async function promoteToAdmin(displayName: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const key = process.env.E2E_SERVICE_ROLE_KEY ?? "";
  const res = await fetch(`${url}/rest/v1/profiles?display_name=eq.${encodeURIComponent(displayName)}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ role: "admin", can_validate_plans: true }),
  });
  expect(res.ok).toBeTruthy();
}

async function adminSession(page: Page): Promise<string> {
  const name = `Admin ${Date.now()}`;
  await signUp(page, uniqueEmail("admin"), name);
  await completeOnboarding(page);
  await promoteToAdmin(name);
  return name;
}

test.describe("panel administrativo", () => {
  test.skip(!backendConfigured || !process.env.E2E_SERVICE_ROLE_KEY, "Requiere backend local y E2E_SERVICE_ROLE_KEY");

  test("versionado de planes: clonar, revisar y publicar sin alterar la versión anterior", async ({ page }) => {
    await adminSession(page);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Resumen del negocio" })).toBeVisible();
    await expect(page.getByText("Pendiente de configuración").first()).toBeVisible();

    await page.goto("/admin/planes");
    await expect(page.getByRole("heading", { name: "DEMO · 10K Intermedio" })).toBeVisible();
    const card = page.locator("section", { has: page.getByRole("heading", { name: "DEMO · 10K Intermedio" }) });
    await card.locator("li", { hasText: "Publicado" }).getByRole("link").click();
    await expect(page.getByText("Estructura válida")).toBeVisible();
    await expect(page.getByText("Versión de solo lectura")).toBeVisible();

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Crear nueva versión desde esta" }).click();
    await expect(page.getByRole("heading", { name: /v\d+$/ })).toBeVisible();
    await expect(page.getByText("Borrador", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page.getByRole("button", { name: "Publicar" })).toBeVisible();
    await page.getByRole("button", { name: "Publicar" }).click();
    await expect(page.getByRole("button", { name: "Archivar" })).toBeVisible();

    await page.goto("/admin/planes");
    const updated = page.locator("section", { has: page.getByRole("heading", { name: "DEMO · 10K Intermedio" }) });
    await expect(updated.getByText("Archivado").first()).toBeVisible();
    await expect(updated.getByText("Publicado")).toHaveCount(1);

    await page.goto("/admin/auditoria");
    await expect(page.getByText("plan_version.published").first()).toBeVisible();
  });

  test("precios administrables, Premium manual y funciones Premium habilitadas", async ({ page, browser }) => {
    await adminSession(page);
    await page.goto("/admin/productos");
    const monthly = page.locator("section", { has: page.getByRole("heading", { name: /Premium mensual/ }) });
    await monthly.getByLabel("Importe").fill("8,49");
    await monthly.getByRole("button", { name: "Guardar precio" }).click();
    await expect(monthly.getByText("Precio actualizado.")).toBeVisible();
    await expect(monthly.getByText("USD 8,49").first()).toBeVisible();

    const anon = await browser.newPage();
    await anon.goto("/");
    await expect(anon.getByText("USD 8,49")).toBeVisible();

    // Restaura el precio de referencia para no afectar otras pruebas.
    await monthly.getByLabel("Importe").fill("7,99");
    await monthly.getByRole("button", { name: "Guardar precio" }).click();
    await expect(monthly.getByText("Precio actualizado.")).toBeVisible();

    // Otro usuario recibe Premium manual y puede usar Hidratación.
    const userPage = await browser.newPage();
    const userName = `Premium ${Date.now()}`;
    await signUp(userPage, uniqueEmail("premium"), userName);
    await completeOnboarding(userPage);
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(userName)}`);
    await page.getByRole("button", { name: "Otorgar 30 días" }).click();
    await expect(page.getByText("Premium · manual")).toBeVisible();

    await userPage.goto("/hidratacion");
    await userPage.getByRole("button", { name: "500 ml" }).click();
    await userPage.getByRole("button", { name: "Agregar" }).click();
    await expect(userPage.getByText("Registro guardado.")).toBeVisible();
    await expect(userPage.getByText("500 ml").first()).toBeVisible();

    await userPage.goto("/competencias");
    await userPage.getByLabel("Nombre").fill("10K de la Ciudad");
    await userPage.getByLabel("Fecha").fill("2026-12-06");
    await userPage.getByLabel("Distancia estándar").selectOption("10K");
    await userPage.getByLabel("Tiempo objetivo (opcional)").fill("55:00");
    await userPage.getByRole("button", { name: "Guardar competencia" }).click();
    await expect(userPage.getByText("Competencia guardada.")).toBeVisible();
    await expect(userPage.getByText(/Objetivo \(estimado\)/)).toBeVisible();
    await expect(userPage.getByText("5:30 /km").first()).toBeVisible();
  });
});
