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
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
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
    await monthly.getByLabel("Importe").fill("25");
    await monthly.getByRole("button", { name: "Guardar precio" }).click();
    await expect(monthly.getByText("Precio actualizado.")).toBeVisible();
    await expect(monthly.getByText("USD 25,00").first()).toBeVisible();

    const anon = await browser.newPage();
    await anon.goto("/");
    await expect(anon.getByText(/US\$ 25\b/).first()).toBeVisible();

    // Restaura el precio de lista para no afectar otras pruebas.
    await monthly.getByLabel("Importe").fill("20");
    await monthly.getByRole("button", { name: "Guardar precio" }).click();
    await expect(monthly.getByText("Precio actualizado.")).toBeVisible();

    // Otro usuario recibe Premium manual y puede usar Hidratación.
    const userPage = await browser.newPage();
    const userName = `Premium ${Date.now()}`;
    await signUp(userPage, uniqueEmail("premium"), userName);
    await completeOnboarding(userPage);
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(userName)}`);
    await page.getByText("Acciones").click();
    await page.getByRole("button", { name: "Otorgar 30 días de Premium" }).click();
    await expect(page.getByText("Premium mensual · activa")).toBeVisible();

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

  test("biblioteca: las semanas gratis se configuran sin tocar el código", async ({ page, browser }) => {
    await adminSession(page);
    await page.goto("/admin/productos");
    await page.getByLabel("Semanas gratis por plan").fill("2");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByLabel("Semanas gratis por plan")).toHaveValue("2");
    // Un usuario gratuito (el administrador ve todo) ahora ve la semana 2.
    const ctx = await browser.newContext();
    const runner = await ctx.newPage();
    try {
      await signUp(runner, uniqueEmail("semanas"));
      await completeOnboarding(runner);
      await runner.goto("/planes/plan-04?semana=2");
      await expect(runner.locator("section[aria-labelledby=semana]").getByRole("heading", { level: 3 })).toHaveCount(3);
      await runner.goto("/planes/plan-04?semana=3");
      await expect(runner.locator("section[aria-labelledby=semana]").getByText("Con la suscripción mensual, cada débito automático libera", { exact: false })).toBeVisible();
    } finally {
      await ctx.close();
      await page.goto("/admin/productos");
      await page.getByLabel("Semanas gratis por plan").fill("1");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
      await expect(page.getByLabel("Semanas gratis por plan")).toHaveValue("1");
    }
  });

  test("panel: métricas, usuarios con correo, acceso total y ver como usuario", async ({ page }) => {
    const email = uniqueEmail("dueno");
    const name = `Dueño ${Date.now()}`;
    await signUp(page, email, name);
    await completeOnboarding(page);
    await promoteToAdmin(name);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
    for (const h of ["Usuarios", "Suscripciones", "Ingresos"]) await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    await expect(page.getByText("Registrados")).toBeVisible();
    await expect(page.getByText("Distancias objetivo más elegidas")).toBeVisible();

    // Listado con correo y búsqueda.
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(email)}`);
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByText("Tu cuenta: acceso total sin suscripción.")).toBeVisible();

    // Acceso total sin pagar: módulos Premium habilitados y ninguna suscripción creada.
    await page.goto("/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toHaveCount(0);

    // Ver como usuario sin suscripción: aviso arriba, sin enlace al panel y con los límites gratis.
    await page.goto("/admin");
    await page.getByRole("button", { name: "Sin suscripción" }).click();
    await expect(page).toHaveURL(/\/inicio/);
    await expect(page.getByText("Estás viendo la app como usuario sin suscripción.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Administración" })).toHaveCount(0);
    await page.goto("/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toBeVisible();
    // El panel no responde en esta vista: hay que volver.
    await page.goto("/admin");
    await expect(page.getByText(/Para usar el panel, volvé a la vista de administrador/)).toBeVisible();
    await page.getByRole("button", { name: "Volver a administrador" }).click();
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();

    // Ver como usuario con suscripción.
    await page.getByRole("button", { name: "Con suscripción" }).click();
    await expect(page.getByText("Estás viendo la app como usuario con suscripción.")).toBeVisible();
    await page.goto("/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toHaveCount(0);
    await page.getByRole("button", { name: "Volver a administrador" }).click();
    await expect(page.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
  });

  test("admin: todas las semanas de todos los planes, en el catálogo y en Mi plan, sin candados", async ({ page }) => {
    await adminSession(page);
    const locked = page.getByRole("link", { name: /se libera con la suscripción/ });

    // Catálogo: la última semana de un plan de 12 semanas, completa y sin candados.
    await page.goto("/planes/plan-07?semana=12");
    await expect(page.getByRole("heading", { name: "Semana 12 de 12" })).toBeVisible();
    await expect(page.locator("section[aria-labelledby=semana]").getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(locked).toHaveCount(0);
    await expect(page.getByText("Se libera con la suscripción")).toHaveCount(0);
    // Un plan largo (48 semanas): también la última.
    await page.goto("/planes/plan-15?semana=48");
    await expect(page.getByRole("heading", { name: "Semana 48 de 48" })).toBeVisible();
    await expect(page.locator("section[aria-labelledby=semana]").getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(locked).toHaveCount(0);

    // Mi plan: inscripto, la tira de semanas no tiene candados y la semana 12 se ve completa.
    await page.goto("/planes?plan=plan-07");
    await page.getByLabel(/Leí los avisos de seguridad/).check();
    await page.getByRole("button", { name: /Empezar/ }).click();
    await expect(page).toHaveURL(/\/plan\?inscripto=1/);
    await expect(locked).toHaveCount(0);
    await page.getByRole("link", { name: /^Semana 12\b/ }).click();
    await expect(page.getByRole("heading", { name: "Semana 12 de 12" })).toBeVisible();
    await expect(page.locator("section[aria-labelledby=semana]").getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(page.getByText("Se libera con la suscripción")).toHaveCount(0);
  });
});
