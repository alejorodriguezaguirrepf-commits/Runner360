import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assessMercadoPagoAccount, looksLikePublicKey, mapMercadoPagoPayment, mapMercadoPagoStatus, parseExternalReference } from "@/lib/payments/mercadopago";
import { verifyMercadoPagoSignature, verifyStripeSignature } from "@/lib/payments/signatures";
import { mapStripeStatus, normalizeStripeEvent } from "@/lib/payments/stripe";
import { redact } from "@/lib/log";

const secret = "whsec_test_secret";

describe("firma de Stripe", () => {
  const payload = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  const t = 1_790_000_000;
  const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  it("acepta una firma válida dentro de la tolerancia", () => {
    expect(verifyStripeSignature({ payload, header: `t=${t},v1=${sig}`, secret, nowS: t + 10 })).toBe(true);
  });
  it("rechaza cuerpo alterado, firma ajena y eventos viejos (replay)", () => {
    expect(verifyStripeSignature({ payload: payload + " ", header: `t=${t},v1=${sig}`, secret, nowS: t })).toBe(false);
    expect(verifyStripeSignature({ payload, header: `t=${t},v1=${sig}`, secret: "otro", nowS: t })).toBe(false);
    expect(verifyStripeSignature({ payload, header: `t=${t},v1=${sig}`, secret, nowS: t + 3600 })).toBe(false);
    expect(verifyStripeSignature({ payload, header: null, secret, nowS: t })).toBe(false);
    expect(verifyStripeSignature({ payload, header: "basura", secret, nowS: t })).toBe(false);
  });
});

describe("firma de Mercado Pago", () => {
  const ts = "1790000000";
  const manifest = `id:abc123;request-id:req-1;ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  it("valida el manifiesto id/request-id/ts", () => {
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "ABC123", secret })).toBe(true);
  });
  it("rechaza datos alterados", () => {
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-2", dataId: "abc123", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "zzz", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "abc123", secret })).toBe(false);
  });
});

describe("normalización de eventos", () => {
  it("mapea estados de Stripe", () => {
    expect(mapStripeStatus("active")).toBe("active");
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("canceled")).toBe("cancelled");
    expect(mapStripeStatus("incomplete")).toBe("pending");
  });
  it("normaliza customer.subscription.updated", () => {
    const e = normalizeStripeEvent({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_start: 1_790_000_000, current_period_end: 1_792_592_000 }] }, metadata: { user_id: "u1", product_code: "premium_monthly" } } },
    });
    expect(e).toMatchObject({ providerSubscriptionId: "sub_1", status: "active", userId: "u1", productCode: "premium_monthly", cancelAtPeriodEnd: true });
    expect(e?.currentPeriodEnd).toBe(new Date(1_792_592_000 * 1000).toISOString());
  });
  it("las bajas se registran como canceladas e ignora otros tipos", () => {
    expect(normalizeStripeEvent({ id: "e", type: "customer.subscription.deleted", data: { object: { id: "s", status: "active" } } })?.status).toBe("cancelled");
    expect(normalizeStripeEvent({ id: "e", type: "invoice.paid" })?.providerSubscriptionId).toBeNull();
  });
  it("Mercado Pago: estados y referencia externa", () => {
    expect(mapMercadoPagoStatus("authorized")).toBe("active");
    expect(mapMercadoPagoStatus("paused")).toBe("past_due");
    expect(parseExternalReference("aaaaaaaa-0000-4000-8000-000000000001:premium_monthly")).toEqual({ userId: "aaaaaaaa-0000-4000-8000-000000000001", productCode: "premium_monthly" });
    expect(parseExternalReference("inyeccion; drop table")).toEqual({ userId: null, productCode: null });
  });
});

describe("registro sin datos personales", () => {
  it("oculta correos, JWT y UUID", () => {
    expect(redact("usuario ana@mail.com id 0a1b2c3d-0000-4000-8000-000000000001 token eyJa.eyJb.c_d")).toBe("usuario [email] id [uuid] token [jwt]");
  });
});

describe("débitos automáticos de Mercado Pago", () => {
  const ap = { id: 7001, preapproval_id: "pre-1", status: "processed", transaction_amount: 4999.5, currency_id: "ARS", debit_date: "2026-11-01T10:00:00.000-03:00", payment: { id: 99, status: "approved" } };

  it("un débito aprobado se normaliza con importe en centavos", () => {
    expect(mapMercadoPagoPayment(ap)).toEqual({ providerPaymentId: "7001", status: "approved", amountMinor: 499950, currency: "ARS", paidAt: "2026-11-01T10:00:00.000-03:00" });
  });

  it("solo 'approved' libera: rechazado, reintento y devolución", () => {
    expect(mapMercadoPagoPayment({ ...ap, payment: { id: 1, status: "rejected" } })?.status).toBe("rejected");
    expect(mapMercadoPagoPayment({ ...ap, status: "recycling", payment: { id: 1, status: "in_process" } })?.status).toBe("pending");
    expect(mapMercadoPagoPayment({ ...ap, payment: undefined, status: "scheduled" })?.status).toBe("pending");
    expect(mapMercadoPagoPayment({ ...ap, payment: { id: 1, status: "refunded" } })?.status).toBe("refunded");
  });

  it("sin id no hay débito", () => {
    expect(mapMercadoPagoPayment({ status: "processed" })).toBeNull();
  });
});

describe("verificación de la cuenta de Mercado Pago", () => {
  const real = { id: 1, nickname: "RUNNER360", site_id: "MLA", tags: ["normal"] };
  const prueba = { id: 2, nickname: "TESTUSER123", site_id: "MLA", tags: ["normal", "test_user"] };
  it("cuenta coherente con MP_ENV: válida", () => {
    expect(assessMercadoPagoAccount(real, "prod")).toEqual({ ok: true, message: "RUNNER360 · cuenta real. Credenciales válidas." });
    expect(assessMercadoPagoAccount(prueba, "test").ok).toBe(true);
  });
  it("cuenta de prueba en producción o real en prueba: error", () => {
    expect(assessMercadoPagoAccount(prueba, "prod")).toMatchObject({ ok: false, message: expect.stringMatching(/cuenta de prueba/) });
    expect(assessMercadoPagoAccount(real, "test")).toMatchObject({ ok: false, message: expect.stringMatching(/cobros serían reales/) });
  });
  it("cuenta de otro país: error; sin MP_ENV: sugiere el valor", () => {
    expect(assessMercadoPagoAccount({ ...real, site_id: "MLB" }, "prod").ok).toBe(false);
    expect(assessMercadoPagoAccount(prueba, null).message).toMatch(/MP_ENV=test/);
  });
  it("token TEST- de una cuenta real: es modo prueba, no cobros reales", () => {
    expect(assessMercadoPagoAccount(real, "test", true)).toEqual({ ok: true, message: "RUNNER360 · credenciales de prueba. Credenciales válidas." });
    expect(assessMercadoPagoAccount(real, "prod", true).ok).toBe(false);
  });
});

describe("Public Key copiada en lugar del Access Token", () => {
  // Valores inventados, armados por partes.
  const uuid = ["1a2b3c4d", "5e6f", "7a8b", "9c0d", "1e2f3a4b5c6d"].join("-");
  const token = ["1".repeat(16), "103012", "ab".repeat(16), "9".repeat(9)].join("-");
  it("distingue la Public Key (UUID) del Access Token", () => {
    expect(looksLikePublicKey(`APP_USR-${uuid}`)).toBe(true);
    expect(looksLikePublicKey(`TEST-${uuid}`)).toBe(true);
    expect(looksLikePublicKey(`APP_USR-${token}`)).toBe(false);
  });
});
