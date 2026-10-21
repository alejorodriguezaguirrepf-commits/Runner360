import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.E2E_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
const YEARLY = "00000000-0000-4000-8000-000000000003";

/** Plan anual pagado (como lo deja el webhook de Mercado Pago), con la clave de servicio. */
async function grantAnnual(displayName: string, endsInDays: number): Promise<void> {
  const res = await fetch(`${SUPABASE}/rest/v1/profiles?display_name=eq.${encodeURIComponent(displayName)}&select=id`, { headers });
  const [{ id }] = (await res.json()) as { id: string }[];
  const start = new Date(Date.now() - (365 - endsInDays) * 86_400_000).toISOString();
  const end = new Date(Date.now() + endsInDays * 86_400_000).toISOString();
  const ins = await fetch(`${SUPABASE}/rest/v1/subscriptions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: id,
      product_id: YEARLY,
      provider: "mercadopago",
      provider_subscription_id: `payment:e2e-${Date.now()}`,
      status: "active",
      started_at: start,
      current_period_start: start,
      current_period_end: end,
      cancel_at_period_end: true,
    }),
  });
  expect(ins.ok, await ins.text()).toBeTruthy();
}

test.describe("plan anual", () => {
  test.skip(!backendConfigured || !KEY, "Requiere backend local y E2E_SERVICE_ROLE_KEY");

  test("anual activo: plan de 3 meses completo desde el inicio y aviso 15 días antes del vencimiento", async ({ page }) => {
    const name = `Anual ${Date.now()}`;
    await signUp(page, uniqueEmail("anual"), name);
    await completeOnboarding(page);
    await grantAnnual(name, 10);

    await page.goto("/suscripcion");
    await expect(page.getByText(/Plan anual activo hasta el/)).toBeVisible();
    await expect(page.getByText("Anual activo", { exact: true })).toBeVisible();
    await expect(page.getByText(/Tu plan anual vence en 10 días/)).toBeVisible();
    await expect(page.getByText(/Ahorrás US\$ 60 \(25 %\)/).first()).toBeVisible();

    // Plan de 3 meses (10 km, 12 semanas): con el anual se ve completo desde el inicio.
    await page.goto("/planes?plan=plan-07");
    await expect(page.getByText("Con tu plan anual, el plan completo queda disponible desde el primer día.")).toBeVisible();
    await page.getByLabel(/Leí los avisos de seguridad/).check();
    await page.getByRole("button", { name: "Empezar este plan" }).click();
    await expect(page).toHaveURL(/\/plan\?inscripto=1/);
    await page.goto("/plan");
    const strip = page.getByRole("navigation", { name: "Semanas del plan" });
    await expect(strip.getByRole("link").filter({ hasText: "12" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /se libera con la suscripción/ })).toHaveCount(0);
  });
});
