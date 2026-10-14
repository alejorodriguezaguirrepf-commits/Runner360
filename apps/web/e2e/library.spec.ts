import { expect, test, type Page } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.E2E_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function newRunner(page: Page, prefix: string) {
  await signUp(page, uniqueEmail(prefix));
  await completeOnboarding(page);
}

test.describe("biblioteca de planes", () => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");

  test("selector: pestañas de distancia → días → duración → nivel, sin evaluación previa", async ({ page }) => {
    await newRunner(page, "catalogo");
    await expect(page.getByRole("heading", { name: "Planes de entrenamiento" })).toBeVisible();
    await expect(page.getByText("Plan gratis", { exact: true })).toBeVisible();
    await expect(page.getByText("Suscripción mensual", { exact: true })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Distancia" });
    for (const km of ["5 km", "10 km", "21 km", "42 km"]) await expect(tabs.getByRole("link", { name: km })).toBeVisible();
    // La pestaña inicial es la distancia del perfil (5 km).
    await expect(tabs.getByRole("link", { name: "5 km" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "10 km" }).click();
    await expect(tabs.getByRole("link", { name: "10 km" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("group", { name: "Días por semana" }).getByRole("link", { name: "4 días" }).click();
    await page.getByRole("group", { name: "Duración del plan" }).getByRole("link", { name: "6 meses (24 semanas)" }).click();
    // El nivel se elige solo (cada distancia tiene uno).
    await expect(page.getByRole("group", { name: "Nivel" }).getByRole("link", { name: "Intermedio" })).toHaveAttribute("aria-current", "true");
    await expect(page.getByRole("heading", { name: "10 km en 6 meses, 4 días" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empezar gratis" })).toBeVisible();
    await page.getByRole("link", { name: "Ver el plan completo" }).click();
    await expect(page).toHaveURL(/\/planes\/plan-11/);

    // 21 km: los días se eligen solos (siempre 6).
    await page.goto("/planes?d=21.0975");
    await expect(page.getByRole("group", { name: "Días por semana" }).getByRole("link", { name: "6 días" })).toHaveAttribute("aria-current", "true");
    // Los enlaces viejos del asistente llevan al selector con el plan elegido.
    await page.goto("/planes/elegir?plan=plan-07");
    await expect(page).toHaveURL(/\/planes\?plan=plan-07/);
    await expect(page.getByRole("heading", { name: "10 km en 3 meses, 3 días" })).toBeVisible();
  });

  test("detalle: solo las tareas, días numerados y semanas por liberar", async ({ page }) => {
    await newRunner(page, "detalle");
    await page.goto("/planes/plan-04");
    await expect(page.getByRole("heading", { name: "5 km desde cero en 3 meses, 3 días" })).toBeVisible();
    // Sin explicaciones del plan.
    for (const gone of ["Valores estimados", "Para quién es", "Objetivo principal", "Fases", "Vista rápida de todas las semanas"]) {
      await expect(page.getByText(gone, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { name: "Semana 1 de 12" })).toBeVisible();
    const strip = page.getByRole("navigation", { name: "Semanas del plan" });
    await expect(strip.getByRole("link", { name: "Semana 1", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(strip.getByRole("link", { name: "Semana 2, se libera con la suscripción" })).toBeVisible();

    // Semana 1: 7 días numerados (Día 1 … Día 7), sin nombres de días; los pasos de la primera sesión a la vista.
    const week = page.locator("section[aria-labelledby=semana]");
    await expect(week.getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(week.getByRole("heading", { name: /^Día 1: Descanso/ })).toBeVisible();
    await expect(week.getByRole("heading", { name: /^Día 7:/ })).toBeVisible();
    await expect(week.getByText(/Lun|Mar ·|Dom/)).toHaveCount(0);
    await expect(week.getByText("Calentamiento").first()).toBeVisible();
    await expect(week.getByText("Vuelta a la calma").first()).toBeVisible();

    await strip.getByRole("link", { name: "Semana 2, se libera con la suscripción" }).click();
    await expect(page.getByRole("heading", { name: "Semana 2 de 12" })).toBeVisible();
    await expect(week.getByText("Con la suscripción mensual, cada débito automático libera", { exact: false })).toBeVisible();
  });

  test("inscripción gratis: calendario con fechas reales, mover días y un solo plan en curso", async ({ page }) => {
    await newRunner(page, "inscripcion");
    await page.getByRole("group", { name: "Días por semana" }).getByRole("link", { name: "3 días" }).click();
    await page.getByRole("group", { name: "Duración del plan" }).getByRole("link", { name: "3 meses (12 semanas)" }).click();
    await expect(page.getByRole("heading", { name: "5 km desde cero en 3 meses, 3 días" })).toBeVisible();
    await expect(page.getByText(/Competencia del plan: domingo/)).toBeVisible();
    // Sin confirmar los avisos de seguridad no empieza.
    await page.getByRole("button", { name: "Empezar gratis" }).click();
    await expect(page.getByText("Para empezar, confirmá que leíste los avisos de seguridad.").first()).toBeVisible();
    await page.getByLabel(/Leí los avisos de seguridad/).check();
    await page.getByRole("button", { name: "Empezar gratis" }).click();
    await expect(page).toHaveURL(/\/plan\?inscripto=1/);
    await expect(page.getByText("¡Listo! Tu calendario está armado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "5 km desde cero en 3 meses, 3 días" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Semana 1 de 12" })).toBeVisible();
    await expect(page.locator("section[aria-labelledby=semana]").getByRole("heading", { level: 3 })).toHaveCount(7);
    await expect(page.getByText("Valores estimados")).toHaveCount(0);

    // Mover días: válido.
    await page.getByRole("link", { name: "Mover días" }).click();
    await page.getByLabel("Lo hago el (Mar)").selectOption("0");
    await page.getByLabel("Lo hago el (Lun)").selectOption("1");
    await page.getByRole("button", { name: "Guardar días" }).click();
    await expect(page.getByText("Días actualizados.")).toBeVisible();

    // La competencia (domingo de la semana 12, fuera de la muestra gratis) no se mueve: lo controla el servidor
    // sobre TODAS las semanas, aunque la persona no vea su detalle.
    await page.reload();
    await page.getByLabel("Lo hago el (Dom)").selectOption("5");
    await page.getByLabel("Lo hago el (Sáb)").selectOption("6");
    await page.getByRole("button", { name: "Guardar días" }).click();
    await expect(page.getByText("La competencia no se puede mover de su día.")).toBeVisible();
    await expect(page.getByText("Días actualizados.")).toHaveCount(0);

    // Un solo plan en curso: no puede empezar otro sin abandonar el actual.
    await page.goto("/planes?plan=plan-05");
    await expect(page.getByText("Ya tenés un plan en curso")).toBeVisible();
    await expect(page.getByRole("button", { name: /Empezar/ })).toHaveCount(0);
  });

  test("suscripción mensual: cada débito aprobado libera 4 semanas del plan", async ({ page }) => {
    test.skip(!KEY, "Requiere E2E_SERVICE_ROLE_KEY");
    const name = `Débitos ${Date.now()}`;
    await signUp(page, uniqueEmail("debitos"), name);
    await completeOnboarding(page, { distance: "10K" });
    await page.getByRole("group", { name: "Días por semana" }).getByRole("link", { name: "3 días" }).click();
    await page.getByRole("group", { name: "Duración del plan" }).getByRole("link", { name: "6 meses (24 semanas)" }).click();
    await page.getByLabel(/Leí los avisos de seguridad/).check();
    await page.getByRole("button", { name: "Empezar gratis" }).click();
    await expect(page).toHaveURL(/\/plan\?inscripto=1/);

    // Gratis: solo la semana 1.
    await page.goto("/planes/plan-10");
    const strip = page.getByRole("navigation", { name: "Semanas del plan" });
    await expect(strip.getByRole("link", { name: "Semana 2, se libera con la suscripción" })).toBeVisible();

    // Dos débitos aprobados (como los registra el aviso de pago) → 8 semanas.
    const res = await fetch(`${SUPABASE}/rest/v1/profiles?display_name=eq.${encodeURIComponent(name)}&select=id`, { headers });
    const [{ id }] = (await res.json()) as { id: string }[];
    const now = Date.now();
    const ins = await fetch(`${SUPABASE}/rest/v1/subscription_payments`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify([1, 2].map((n) => ({
        user_id: id, provider: "mercadopago", provider_payment_id: `e2e-${now}-${n}`, status: "approved",
        amount_minor: 500000, currency: "ARS", paid_at: new Date(now - n * 60_000).toISOString(),
      }))),
    });
    expect(ins.ok, await ins.text()).toBeTruthy();
    await page.reload();
    await expect(strip.getByRole("link", { name: "Semana 8", exact: true })).toBeVisible();
    await expect(strip.getByRole("link", { name: "Semana 9, se libera con la suscripción" })).toBeVisible();
    await page.goto("/suscripcion");
    await expect(page.getByText("Aprobado · mes liberado")).toHaveCount(2);
  });
});
