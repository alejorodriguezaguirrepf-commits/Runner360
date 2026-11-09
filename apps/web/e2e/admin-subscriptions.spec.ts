import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

/** Panel de suscripciones: quién compró, quién la tiene asignada a mano y cuándo se le debitó. */
const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-c", q]).toString().trim();

test("admin: ve quién compró y el historial de débitos", async ({ page, browser }) => {
  test.skip(!backendConfigured, "Requiere backend Supabase (E2E_WITH_BACKEND=1)");
  // Un usuario que compró por Mercado Pago, con un débito aprobado y uno rechazado.
  const buyer = uniqueEmail("compro");
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await signUp(other, buyer);
  await ctx.close();
  const uid = sql(`select id from auth.users where email = '${buyer}'`);
  const product = sql(`select id from public.subscription_products where tier = 'premium' and billing_interval = 'month' limit 1`);
  const sub = sql(`insert into public.subscriptions (user_id, product_id, provider, provider_subscription_id, status, started_at, current_period_start, current_period_end)
    values ('${uid}', '${product}', 'mercadopago', 'pre-${uid}', 'active', now() - interval '35 days', now() - interval '5 days', now() + interval '25 days') returning id`);
  sql(`insert into public.subscription_payments (user_id, subscription_id, provider, provider_payment_id, status, amount_minor, currency, paid_at, failure_code) values
    ('${uid}', '${sub}', 'mercadopago', 'e2e-a-${uid}', 'approved', 2000000, 'ARS', now() - interval '35 days', null),
    ('${uid}', '${sub}', 'mercadopago', 'e2e-r-${uid}', 'rejected', 2000000, 'ARS', now() - interval '5 days', 'cc_rejected_insufficient_amount')`);

  // El admin (el rol solo se asigna en la base).
  const admin = uniqueEmail("admin-subs");
  await signUp(page, admin);
  await completeOnboarding(page);
  sql(`update public.profiles set role = 'admin' where id = (select id from auth.users where email = '${admin}')`);

  await page.goto("/admin/suscripciones?vista=compraron");
  await expect(page.getByRole("heading", { name: "Suscripciones" })).toBeVisible();
  const card = page.getByRole("listitem").filter({ hasText: buyer });
  await expect(card.getByText("Compró")).toBeVisible();
  await expect(card.getByText("Próximo débito")).toBeVisible();
  await card.getByText("Ver débitos (2)").click();
  await expect(card.getByText("Aprobado")).toBeVisible();
  await expect(card.getByText("Rechazado")).toBeVisible();

  await page.getByRole("link", { name: "Todos los débitos" }).click();
  await expect(page.getByRole("link", { name: new RegExp(buyer) }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
