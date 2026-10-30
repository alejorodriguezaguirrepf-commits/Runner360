import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import { backendConfigured, completeOnboarding, signUp, uniqueEmail } from "./helpers";

/**
 * Notificaciones de pagos de punta a punta, con avisos firmados como los de Mercado Pago y un
 * servidor local que responde como su API (MP_API_BASE). Requiere que la web corra con
 * MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET=e2e-webhook-secret, MP_API_BASE=http://127.0.0.1:4599 y
 * CRON_SECRET=e2e-cron-secret (ver docs/payments.md → Pruebas).
 */
const SECRET = "e2e-webhook-secret";
const CRON = "e2e-cron-secret";
const MP_PORT = 4599;
const DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54322/postgres";
const sql = (q: string) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-q", "-A", "-t", "-c", q]).toString().trim();

// API simulada de Mercado Pago: lo que devuelve cada recurso lo arma la prueba.
const mp = new Map<string, unknown>();
let server: Server;

async function webhook(page: Page, type: string, dataId: string, eventId: string) {
  const requestId = `req-${eventId}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const v1 = createHmac("sha256", SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  const res = await page.request.post(`/api/webhooks/mercadopago?data.id=${dataId}&type=${type}`, {
    headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId, "content-type": "application/json" },
    data: { id: eventId, type, action: "updated", data: { id: dataId } },
  });
  expect(res.status(), await res.text()).toBe(200);
  return res.json() as Promise<{ duplicate?: boolean }>;
}

function debit(id: string, preId: string, status: "approved" | "rejected", detail?: string) {
  mp.set(`/authorized_payments/${id}`, {
    id,
    preapproval_id: preId,
    status: "processed",
    transaction_amount: 20000,
    currency_id: "ARS",
    debit_date: new Date().toISOString(),
    payment: { id: Number(id.replace(/\D/g, "")) || 1, status, ...(detail ? { status_detail: detail } : {}) },
  });
}

test.describe("notificaciones de pagos", () => {
  test.skip(!backendConfigured || !process.env.E2E_PAYMENTS, "Requiere backend local y la web con la configuración de pagos de prueba (E2E_PAYMENTS=1)");

  test.beforeAll(async () => {
    server = createServer((req, res) => {
      const body = mp.get((req.url ?? "").split("?")[0]!);
      res.writeHead(body ? 200 : 404, { "content-type": "application/json" });
      res.end(JSON.stringify(body ?? { message: "not found" }));
    });
    await new Promise<void>((r) => server.listen(MP_PORT, "127.0.0.1", r));
  });
  test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

  test("aprobado, aviso repetido, rechazo por fondos insuficientes, regularización y fin de la gracia", async ({ page, browser }) => {
    const email = uniqueEmail("pagos");
    await signUp(page, email, "Corredora Pagos");
    await completeOnboarding(page);
    const userId = sql(`select id from auth.users where email = '${email}'`);
    const pre = `pre${Date.now()}`;
    mp.set(`/preapproval/${pre}`, { id: pre, status: "authorized", external_reference: `${userId}:premium_monthly`, date_created: new Date().toISOString(), next_payment_date: new Date(Date.now() + 30 * 864e5).toISOString() });
    const notifications = (kind: string) => Number(sql(`select count(*) from public.admin_notifications where user_id = '${userId}' and kind = '${kind}'`));

    // Alta de la suscripción y primer débito aprobado: una notificación al admin.
    await webhook(page, "subscription_preapproval", pre, `ev-${pre}-alta`);
    debit(`${pre}1`, pre, "approved");
    await webhook(page, "subscription_authorized_payment", `${pre}1`, `ev-${pre}-1`);
    expect(notifications("payment_approved")).toBe(1);
    expect(sql(`select data->>'first_payment' from public.admin_notifications where user_id = '${userId}' and kind = 'payment_approved'`)).toBe("true");

    // Mercado Pago repite el aviso (mismo evento y otro evento por el mismo débito): no se duplica.
    expect((await webhook(page, "subscription_authorized_payment", `${pre}1`, `ev-${pre}-1`)).duplicate).toBe(true);
    await webhook(page, "subscription_authorized_payment", `${pre}1`, `ev-${pre}-1-bis`);
    expect(notifications("payment_approved")).toBe(1);

    // Débito rechazado por fondos insuficientes: gracia de 5 días, cartel y aviso al admin.
    debit(`${pre}2`, pre, "rejected", "cc_rejected_insufficient_amount");
    await webhook(page, "subscription_authorized_payment", `${pre}2`, `ev-${pre}-2`);
    expect(sql(`select status || ':' || (grace_until > now() + interval '4 days' and grace_until < now() + interval '6 days') from public.subscriptions where provider_subscription_id = '${pre}'`)).toBe("past_due:true");
    expect(sql(`select failure_code from public.subscription_payments where provider_payment_id = '${pre}2'`)).toBe("cc_rejected_insufficient_amount");
    expect(notifications("payment_failed")).toBe(1);
    // Un aviso de "suscripción autorizada" posterior no saca de la gracia.
    await webhook(page, "subscription_preapproval", pre, `ev-${pre}-alta-2`);
    expect(sql(`select status from public.subscriptions where provider_subscription_id = '${pre}'`)).toBe("past_due");

    await page.goto("/inicio");
    const alert = page.getByRole("alert").filter({ hasText: "No pudimos cobrar tu suscripción" });
    await expect(alert).toContainText("la tarjeta no tiene fondos suficientes");
    await expect(alert.getByRole("link", { name: "Actualizar medio de pago" })).toHaveAttribute("href", /mercadopago\.com\.ar\/subscriptions/);
    await page.goto("/perfil");
    await expect(page.getByText("Premium", { exact: true }).first()).toBeVisible(); // conserva el acceso en la gracia

    // Admin: campana con contador, filtro por tipo, pagos con problemas y marcar como leídas.
    const adminEmail = uniqueEmail("admin-pagos");
    const adminPage = await browser.newPage();
    await signUp(adminPage, adminEmail, "Admin Pagos");
    await completeOnboarding(adminPage);
    sql(`update public.profiles set role = 'admin' where id = (select id from auth.users where email = '${adminEmail}')`);
    await adminPage.goto("/admin/notificaciones?tipo=payment_failed");
    await expect(adminPage.getByRole("link", { name: /Notificaciones: \d+ sin leer/ })).toBeVisible();
    const card = adminPage.locator("li", { hasText: email });
    await expect(card).toContainText("Motivo: la tarjeta no tiene fondos suficientes");
    await expect(card.getByRole("link", { name: "Ver usuario" })).toHaveAttribute("href", `/admin/usuarios?q=${encodeURIComponent(email)}`);
    await adminPage.goto("/admin/pagos");
    await expect(adminPage.locator("li", { hasText: email })).toContainText("En gracia hasta");
    await adminPage.goto("/admin/notificaciones");
    await adminPage.getByRole("button", { name: "Marcar todas como leídas" }).click();
    await expect(adminPage.getByRole("link", { name: /sin leer/ })).toHaveCount(0);

    // Se regulariza: sale el cartel, se confirma que está todo en orden y el caso queda resuelto.
    debit(`${pre}3`, pre, "approved");
    await webhook(page, "subscription_authorized_payment", `${pre}3`, `ev-${pre}-3`);
    expect(sql(`select status || ':' || coalesce(grace_until::text, 'sin gracia') from public.subscriptions where provider_subscription_id = '${pre}'`)).toBe("active:sin gracia");
    expect(notifications("payment_recovered")).toBe(1);
    await page.goto("/inicio");
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos cobrar" })).toHaveCount(0);
    await expect(page.getByText(/todo en orden/i)).toBeVisible();
    await page.getByRole("button", { name: "Entendido" }).click();
    await expect(page.getByText(/todo en orden/i)).toHaveCount(0);
    await adminPage.goto("/admin/pagos");
    await expect(adminPage.locator("li", { hasText: email })).toContainText("Regularizado");

    // Otro rechazo que no se regulariza: al vencer la gracia, la tarea diaria corta el acceso y avisa.
    debit(`${pre}4`, pre, "rejected", "cc_rejected_card_disabled");
    await webhook(page, "subscription_authorized_payment", `${pre}4`, `ev-${pre}-4`);
    sql(`update public.subscriptions set grace_until = now() - interval '1 minute' where provider_subscription_id = '${pre}'`);
    const cron = await page.request.get("/api/cron/diario", { headers: { authorization: `Bearer ${CRON}` } });
    expect(cron.ok()).toBeTruthy();
    expect(sql(`select status from public.subscriptions where provider_subscription_id = '${pre}'`)).toBe("expired");
    expect(notifications("access_ended")).toBe(1);
    await page.goto("/inicio");
    await expect(page.getByText(/pausamos el acceso Premium/)).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "No pudimos cobrar tu suscripción porque" })).toHaveCount(0);
    // Correr la tarea otra vez no repite el aviso.
    await page.request.get("/api/cron/diario", { headers: { authorization: `Bearer ${CRON}` } });
    expect(notifications("access_ended")).toBe(1);
  });
});
