import { expect, test } from "@playwright/test";
import { backendConfigured, signUp, uniqueEmail } from "./helpers";

test.describe("registro e ingreso: casos de error", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("valida contraseña y términos en el servidor con mensajes claros", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre visible").fill("Prueba");
    await page.getByLabel("Correo electrónico").fill(uniqueEmail("valida"));
    await page.getByLabel("Contraseña").fill("solotexto");
    await page.getByRole("button", { name: "Comenzar gratis" }).click();
    await expect(page.getByText("La contraseña debe tener al menos 10 caracteres")).toBeVisible();
    await expect(page.getByText("Tenés que aceptar los términos")).toBeVisible();
    await page.getByLabel("Contraseña").fill("solotextolargo");
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Comenzar gratis" }).click();
    await expect(page.getByText("Incluí al menos un número")).toBeVisible();
  });

  test("correo ya registrado y credenciales incorrectas", async ({ page, browser }) => {
    const email = uniqueEmail("duplicado");
    await signUp(page, email);
    const other = await browser.newPage();
    await other.goto("/registro");
    await other.getByLabel("Nombre visible").fill("Otra");
    await other.getByLabel("Correo electrónico").fill(email);
    await other.getByLabel("Contraseña").fill("claveSegura123");
    await other.getByLabel(/Acepto los/).check();
    await other.getByRole("button", { name: "Comenzar gratis" }).click();
    await expect(other.getByText("Ya existe una cuenta con ese correo")).toBeVisible();

    await other.goto("/ingresar");
    await other.getByLabel("Correo electrónico").fill(email);
    await other.getByLabel("Contraseña").fill("claveIncorrecta1");
    await other.getByRole("button", { name: "Ingresar" }).click();
    await expect(other.getByText("Correo o contraseña incorrectos.")).toBeVisible();

    await other.getByLabel("Contraseña").fill("claveSegura123");
    await other.getByRole("button", { name: "Ingresar" }).click();
    await expect(other).toHaveURL(/\/onboarding/);
  });

  test("un error de validación no borra lo que el usuario ya cargó", async ({ page }) => {
    await signUp(page, uniqueEmail("conserva"));
    await page.getByLabel("Fecha de nacimiento").fill("1990-05-10");
    await page.getByLabel("Distancia objetivo").selectOption("10K");
    await page.getByLabel("Kilómetros semanales actuales").fill("12");
    // Falta elegir días y otros datos: el servidor rechaza, pero lo cargado se conserva.
    await page.getByRole("button", { name: "Guardar y ver mi plan" }).click();
    await expect(page.getByText("Revisá los campos marcados.")).toBeVisible();
    await expect(page.getByLabel("Fecha de nacimiento")).toHaveValue("1990-05-10");
    await expect(page.getByLabel("Distancia objetivo")).toHaveValue("10K");
    await expect(page.getByLabel("Kilómetros semanales actuales")).toHaveValue("12");
  });

  test("ingreso redirige a la página pedida originalmente", async ({ page, context }) => {
    const email = uniqueEmail("next");
    await signUp(page, email);
    await context.clearCookies();
    await page.goto("/progreso");
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fprogreso/);
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("claveSegura123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    // Sin onboarding completo, el área privada lleva al cuestionario.
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

test.describe("enlaces de los correos", () => {
  test("enlace de confirmación abierto en otro navegador: invita a ingresar", async ({ page }) => {
    await page.goto("/auth/confirm?code=codigo-de-otro-navegador&next=/onboarding");
    await expect(page).toHaveURL(/\/ingresar\?confirmado=1/);
    await expect(page.getByText("Tu correo quedó confirmado")).toBeVisible();
  });
  test("enlace de recuperación abierto en otro navegador", async ({ page }) => {
    await page.goto("/auth/confirm?code=codigo-de-otro-navegador&next=/restablecer");
    await expect(page.getByText("abrí el enlace desde el mismo navegador")).toBeVisible();
  });
  test("enlace vencido", async ({ page }) => {
    await page.goto("/auth/confirm?error=access_denied&error_code=otp_expired&next=/onboarding");
    await expect(page.getByText("El enlace venció.")).toBeVisible();
  });
  test("diagnóstico sin valores sensibles", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(Object.keys(body.variables)).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(JSON.stringify(body)).not.toMatch(/eyJ|sb_|https?:\/\//);
  });
});
