import { expect, test, type Page } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.E2E_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

/** Mapeos válidos de plan-05 que ponen una sesión de la semana 1 en cada día (0 = lunes … 6 = domingo). */
const MAP_FOR_WEEKDAY: Record<number, number[]> = {
  0: [1, 0, 2, 3, 4, 5, 6],
  1: [0, 1, 2, 3, 4, 5, 6],
  2: [0, 1, 3, 4, 5, 2, 6],
  3: [0, 1, 2, 3, 4, 5, 6],
  4: [0, 1, 2, 3, 5, 4, 6],
  5: [0, 1, 2, 3, 4, 5, 6],
  6: [0, 1, 2, 3, 4, 5, 6],
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000));
const weekday = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
const todayBA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

/**
 * Inscribe a la persona en plan-05 con inicio el lunes de la SEMANA PASADA (con la clave de servicio,
 * solo en el entorno local), para que hoy caiga en la semana 2 y la semana 1 tenga check-in pendiente.
 */
async function enrollStartedLastWeek(page: Page, name: string) {
  const res = await fetch(`${SUPABASE}/rest/v1/profiles?display_name=eq.${encodeURIComponent(name)}&select=id`, { headers });
  const [{ id }] = (await res.json()) as { id: string }[];
  const today = todayBA();
  const start = addDays(today, -weekday(today) - 7);
  const ins = await fetch(`${SUPABASE}/rest/v1/plan_enrollments`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: id,
      content_version: "2026.10",
      plan_id: "plan-05",
      start_date: start,
      race_date: addDays(start, 11 * 7 + 6),
      day_map: MAP_FOR_WEEKDAY[weekday(today)],
    }),
  });
  expect(ins.ok, await ins.text()).toBeTruthy();
  await page.goto("/hoy");
}

test.describe("Hoy, registro, reglas y check-in", () => {
  test.skip(!backendConfigured || !KEY, "Requiere backend local y E2E_SERVICE_ROLE_KEY");

  test("check-in con sesiones perdidas → repetir; registro; dolor > 5 pausa; retomar", async ({ page }) => {
    const name = `Progreso ${Date.now()}`;
    await signUp(page, uniqueEmail("progreso"), name);
    await completeOnboarding(page);
    await enrollStartedLastWeek(page, name);

    // Check-in pendiente de la semana 1 (no registró nada): el motor recomienda repetir.
    const checkin = page.locator("section", { has: page.getByRole("heading", { name: "Check-in semanal" }) });
    await expect(checkin).toBeVisible();
    await expect(checkin.getByText("Criterio para pasar a la siguiente")).toBeVisible();
    await checkin.getByText("No", { exact: true }).click();
    await expect(checkin.getByText("Repetir la semana.", { exact: true })).toBeVisible();
    await expect(checkin.getByText(/Dos o más sesiones perdidas en una semana: repetir la semana/)).toBeVisible();
    // Con una recomendación conservadora no se ofrece avanzar.
    await expect(checkin.getByText("Avanzar", { exact: true })).toHaveCount(0);
    await checkin.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText("Check-in guardado. El calendario quedó actualizado.")).toBeVisible();

    // Repetir desplaza el calendario: hoy se hace de nuevo la semana 1 (Mi plan ya no muestra la tarjeta de semana actual y competencia).
    await page.reload();
    await expect(page.getByText("Sesión de hoy · semana 1 del plan")).toBeVisible();
    await page.goto("/plan");
    await expect(page.getByText("Semana actual")).toHaveCount(0);
    await expect(page.getByText("Competencia", { exact: true })).toHaveCount(0);

    // Registro post-sesión (con consentimiento para datos de salud).
    await page.goto("/hoy");
    await expect(page.getByText("Calentamiento").first()).toBeVisible();
    await page.getByLabel("Duración real (mm:ss o h:mm:ss)").fill("35:00");
    await page.getByLabel("Esfuerzo percibido (RPE 1–10)").fill("4");
    await page.getByLabel("Dolor (0–10)").fill("1");
    await page.locator("label", { hasText: /^Bien$/ }).click();
    await page.getByRole("button", { name: "Guardar registro" }).click();
    await expect(page.getByText("Para registrar dolor, señales o sueño necesitamos tu consentimiento expreso.").first()).toBeVisible();
    await page.getByLabel(/Doy mi consentimiento expreso para registrar datos de salud/).check();
    await page.getByRole("button", { name: "Guardar registro" }).click();
    await expect(page.getByText("Registro guardado.")).toBeVisible();

    // Dolor > 5: suspender y consultar (texto del contenido) y el plan se pausa.
    await page.reload();
    await page.getByLabel("Dolor (0–10)").fill("7");
    await page.getByRole("button", { name: "Guardar registro" }).click();
    await expect(page.getByText(/Suspendé el entrenamiento y consultá a un profesional de la salud/)).toBeVisible();
    await expect(page.getByText(/Más de 5, cojera, dolor localizado en un hueso/)).toBeVisible();
    await page.reload();
    await expect(page.getByText("Tu plan está en pausa.")).toBeVisible();

    // Retomar (en la misma semana).
    await page.getByRole("button", { name: "Retomar el plan" }).click();
    await expect(page.getByText("Sesión de hoy · semana 1 del plan")).toBeVisible();

    // Progreso: planificado contra real, adherencia y zonas.
    await page.goto("/progreso");
    const progress = page.locator("section", { has: page.getByRole("heading", { name: "Tu plan: planificado y real" }) });
    await expect(progress).toBeVisible();
    await expect(progress.getByText("Adherencia")).toBeVisible();
    await expect(progress.getByRole("columnheader", { name: "Zonas de lo completado" })).toBeVisible();

    // Borrar los datos de salud.
    await page.goto("/perfil");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar mis datos de salud" }).click();
    await expect(page.getByText("Borramos tus datos de salud de los registros y retiramos tu consentimiento.")).toBeVisible();
  });

  test("criterio cumplido sin señales: se ofrece avanzar", async ({ page }) => {
    const name = `Avanza ${Date.now()}`;
    await signUp(page, uniqueEmail("avanza"), name);
    await completeOnboarding(page);
    await enrollStartedLastWeek(page, name);
    const checkin = page.locator("section", { has: page.getByRole("heading", { name: "Check-in semanal" }) });
    await checkin.getByText("Sí", { exact: true }).click();
    // Igual hubo sesiones perdidas la semana pasada: el motor no recomienda avanzar.
    await expect(checkin.getByText("Repetir la semana.", { exact: true })).toBeVisible();
  });
});
