import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

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
    await expect(other.getByText("Ya tenés una cuenta con este correo.")).toBeVisible();
    await expect(other.getByRole("link", { name: "Ingresá", exact: true }).first()).toHaveAttribute("href", "/ingresar");
    await expect(other.getByRole("link", { name: "recuperá tu contraseña" })).toHaveAttribute("href", "/recuperar");

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

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.E2E_SERVICE_ROLE_KEY ?? "";
const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-c", q]).toString().trim();

test.describe("registro en un paso", () => {
  test.skip(!backendConfigured || !SERVICE_KEY, "Requiere backend local y E2E_SERVICE_ROLE_KEY");

  test("registro, entrada directa, cierre de sesión, nuevo ingreso y recuperación de contraseña", async ({ page }) => {
    const email = uniqueEmail("unpaso");
    // Registro: sin correo de confirmación, entra directo a las preguntas del plan.
    await signUp(page, email, "Un Paso");
    await expect(page.getByText(/confirm|revisá tu correo/i)).toHaveCount(0);
    expect(sql(`select email_confirmed_at is not null from auth.users where email = '${email}'`)).toBe("t");

    await completeOnboarding(page);

    // Cierre de sesión y nuevo ingreso con la contraseña.
    await page.goto("/inicio");
    await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
    await expect(page).toHaveURL("/");
    await page.goto("/ingresar");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("claveSegura123");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/inicio/);

    // Recuperación: se pide desde "Olvidé mi contraseña" y se abre el enlace del correo.
    await page.context().clearCookies();
    await page.goto("/recuperar");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByRole("button", { name: /Enviar/ }).click();
    await expect(page.getByText("Si el correo está registrado")).toBeVisible();
    const link = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "recovery", email }),
    });
    expect(link.ok, await link.clone().text()).toBeTruthy();
    const { hashed_token } = (await link.json()) as { hashed_token: string };
    await page.goto(`/auth/confirm?token_hash=${hashed_token}&type=recovery&next=/restablecer`);
    await expect(page.getByRole("heading", { name: "Nueva contraseña" })).toBeVisible();
    await page.getByLabel("Contraseña nueva").fill("otraClave456");
    await page.getByLabel("Repetí la contraseña").fill("otraClave456");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByRole("link", { name: "Ir al inicio" })).toBeVisible();
    await page.context().clearCookies();
    await page.goto("/ingresar");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill("otraClave456");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/inicio/);
  });

  test("sugiere el dominio correcto si hay un error de tipeo", async ({ page }) => {
    await page.goto("/registro");
    const field = page.getByLabel("Correo electrónico");
    await field.fill("corredora@gmial.com");
    await page.getByLabel("Contraseña").focus();
    await page.getByRole("button", { name: "corredora@gmail.com" }).click();
    await expect(field).toHaveValue("corredora@gmail.com");
  });

  test("registrarse con el correo del dueño no da el rol de administrador", async ({ page }) => {
    const owner = "alejorodriguezaguirrepf@gmail.com";
    sql(`delete from auth.users where lower(email) = '${owner}'`);
    try {
      await signUp(page, owner, "Dueño E2E");
      expect(sql(`select p.role from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = '${owner}'`)).toBe("user");
      const res = await page.goto("/admin");
      expect(res?.status()).toBe(404);
    } finally {
      sql(`delete from auth.users where lower(email) = '${owner}'`);
    }
  });
});

test.describe("enlaces de los correos", () => {
  test("un enlace sin sesión que no es de recuperación avisa que no es válido", async ({ page }) => {
    await page.goto("/auth/confirm?code=codigo-de-otro-navegador&next=/onboarding");
    await expect(page).toHaveURL(/\/ingresar\?error=enlace/);
    await expect(page.getByText("El enlace no es válido o ya se usó.")).toBeVisible();
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
