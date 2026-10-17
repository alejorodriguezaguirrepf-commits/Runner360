import { expect, test } from "@playwright/test";
import { backendConfigured } from "./helpers";

const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.E2E_SERVICE_ROLE_KEY ?? "";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

test.describe("precio en dólares con equivalente en pesos", () => {
  test.skip(!backendConfigured || !KEY, "Requiere backend Supabase y E2E_SERVICE_ROLE_KEY");

  test("portada: US$ 20 por mes, ≈ pesos con la cotización guardada y la leyenda", async ({ page, request }) => {
    const res = await request.post(`${SUPABASE}/rest/v1/fx_rates`, {
      headers,
      data: { source: "dolarapi", rate_type: "oficial", rate: 1499.95, quoted_at: "2026-10-16T15:00:00Z" },
    });
    expect(res.ok()).toBe(true);
    await page.goto("/#precios");
    const prices = page.locator("#precios");
    await expect(prices.getByText(/^US\$ 20/)).toBeVisible();
    await expect(prices.getByText("≈ $ 29.999 por mes")).toBeVisible();
    await expect(prices.getByText(/^US\$ 180/)).toBeVisible();
    await expect(prices.getByText("≈ $ 269.991 por año")).toBeVisible();
    await expect(prices.getByText(/Se cobra en pesos argentinos/).first()).toBeVisible();
    await expect(prices.getByText(/dólar oficial del 16 de octubre de 2026/).first()).toBeVisible();
    await expect(prices.getByText(/USD 8|7,99/)).toHaveCount(0);
  });
});
