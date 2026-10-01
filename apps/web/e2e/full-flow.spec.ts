import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

/**
 * Flujo vertical completo contra un backend Supabase real (local). Etiqueta @backend.
 * Requiere: app construida con las variables de scripts/local-stack (o `supabase start`) y E2E_BACKEND=1.
 * Para promover a admin se usa psql local (E2E_PSQL_DB), simulando la acción de un operador.
 */
const email = `e2e+${Date.now()}@example.com`;
const password = "Corredor2026";

function sql(query: string) {
  const db = process.env.E2E_PSQL_DB ?? "runner360_local";
  return execFileSync("sudo", ["-u", "postgres", "psql", "-d", db, "-tAc", query]).toString().trim();
}

async function fillOnboarding(page: Page) {
  await page.getByLabel("Nombre visible").fill("Ana E2E");
  await page.getByLabel(/Fecha de nacimiento/).fill("1990-05-10");
  await page.getByLabel("Distancia objetivo").selectOption("10k");
  await page.getByLabel("Nivel").selectOption("intermediate");
  await page.getByLabel("Meses corriendo").fill("24");
  await page.getByLabel("Km por semana (actual)").fill("25");
  for (const d of ["Lunes", "Miércoles", "Viernes", "Domingo"]) await page.getByLabel(d, { exact: true }).check();
}

test.describe.serial("Flujo completo con backend @backend", () => {
  test("registro, onboarding, plan, calendario, registro y progreso", async ({ page }) => {
    // Registro
    await page.goto("/registro");
    await page.getByLabel("Nombre visible").fill("Ana E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByLabel("Repetí la contraseña").fill(password);
    await page.getByLabel(/Leí y acepto/).check();
    await page.getByRole("button", { name: "Crear cuenta gratis" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    expect(sql(`select count(*) from public.user_consents c join public.profiles p on p.id = c.user_id where p.email = '${email}'`)).toBe("2");

    // Rutas privadas sin onboarding redirigen
    await page.goto("/app");
    await expect(page).toHaveURL(/\/onboarding/);

    // Onboarding con error de validación del servidor (días faltantes)
    await page.getByLabel("Nombre visible").fill("Ana E2E");
    await page.getByLabel(/Fecha de nacimiento/).fill("1990-05-10");
    await page.getByLabel("Meses corriendo").fill("24");
    await page.getByRole("button", { name: "Ver mi plan sugerido" }).click();
    await expect(page.getByText("Elegí al menos un día")).toBeVisible();

    await fillOnboarding(page);
    await page.getByRole("button", { name: "Ver mi plan sugerido" }).click();
    await expect(page).toHaveURL(/\/app\/plan/);
    await expect(page.getByRole("heading", { name: "Tu plan sugerido" })).toBeVisible();
    await expect(page.getByText("10K · Intermedio (DEMO / NO VALIDADO)")).toBeVisible();
    await expect(page.getByText("DEMO / NO VALIDADO").first()).toBeVisible();

    // Iniciar plan → calendario
    await page.getByRole("button", { name: "Comenzar este plan" }).click();
    await expect(page.getByText("¡Plan iniciado!")).toBeVisible();
    await expect(page.getByText("Semana 1", { exact: false }).first()).toBeVisible();
    expect(sql(`select count(*) from public.user_training_calendar c join public.profiles p on p.id = c.user_id where p.email = '${email}'`)).toBe("40");

    // Dashboard
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Hola, Ana E2E" })).toBeVisible();
    await expect(page.getByText("Próxima sesión").or(page.getByText("Entrenamiento de hoy"))).toBeVisible();
    await expect(page.getByText("Semana del plan")).toBeVisible();

    // Registro manual: 5 km en 27:30 → 5:30 /km
    await page.goto("/app/registrar");
    await page.getByLabel("Distancia (km)").fill("5");
    await page.getByLabel("Duración").fill("27:30");
    await expect(page.getByText("Ritmo: 5:30 /km")).toBeVisible();
    await expect(page.getByText("Velocidad: 10,9 km/h")).toBeVisible();
    await page.getByLabel("RPE (1-10)").fill("4");
    await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
    await expect(page).toHaveURL(/\/app\/historial\?guardado=1/);
    await expect(page.getByText("5:30 /km")).toBeVisible();
    expect(sql(`select avg_pace_s_per_km from public.workout_logs w join public.profiles p on p.id = w.user_id where p.email = '${email}'`)).toBe("330.00");

    // Valores inválidos rechazados por el servidor
    await page.goto("/app/registrar");
    await page.getByLabel("Distancia (km)").fill("5");
    await page.getByLabel("Duración").fill("abc");
    await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
    await expect(page.getByText("Revisá los datos ingresados.")).toBeVisible();

    // Progreso derivado de registros reales
    await page.goto("/app/progreso");
    await expect(page.getByText("Km últimos 28 días")).toBeVisible();
    await expect(page.getByText("5 km").first()).toBeVisible();

    // Premium bloqueado en Free
    await page.goto("/app/hidratacion");
    await expect(page.getByText("Hidratación está incluido en Premium")).toBeVisible();

    // Un usuario común no accede al panel
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app\?error=permisos/);
  });

  test("admin: estadísticas, Premium manual e hidratación habilitada", async ({ page }) => {
    sql(`insert into public.user_roles (user_id, role) select id, 'admin' from public.profiles where email = '${email}' on conflict do nothing`);
    await page.goto("/ingresar");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Panel administrativo" })).toBeVisible();
    await expect(page.getByText("Planes activos")).toBeVisible();

    await page.goto(`/admin/usuarios?q=${encodeURIComponent(email)}`);
    await page.getByRole("button", { name: "Dar Premium (días)" }).click();
    await expect(page.getByText("manual").first()).toBeVisible();

    await page.goto("/app/hidratacion");
    await page.getByRole("button", { name: "500 ml" }).click();
    await page.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Registro guardado.")).toBeVisible();
    await expect(page.getByText("500 ml").first()).toBeVisible();

    await page.goto("/admin/planes");
    await expect(page.getByRole("heading", { name: "Planes de entrenamiento" })).toBeVisible();
    await page.getByRole("link", { name: "v1" }).first().click();
    await expect(page.getByText("Versión no editable. Para cambiarla, creá una versión nueva.")).toBeVisible();
    await expect(page.getByText("Sin errores.")).toBeVisible();

    await page.goto("/admin/auditoria");
    await expect(page.getByText("grant_subscription").first()).toBeVisible();
  });
});
