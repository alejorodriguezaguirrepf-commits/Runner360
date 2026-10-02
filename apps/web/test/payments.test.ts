import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapMercadoPagoStatus, parseExternalReference } from "@/lib/payments/mercadopago";
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
