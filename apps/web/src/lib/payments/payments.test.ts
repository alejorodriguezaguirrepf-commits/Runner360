import { describe, expect, it } from "vitest";
import { hmacSha256Hex } from "./crypto";
import { mapMercadoPagoStatus, parseExternalReference, verifyMercadoPagoSignature } from "./mercadopago";
import { mapStripeStatus, normalizeStripeEvent, verifyStripeSignature } from "./stripe";

describe("Stripe", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
  it("acepta una firma válida dentro de la tolerancia", () => {
    const t = 1_800_000_000;
    const sig = hmacSha256Hex(secret, `${t}.${body}`);
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 10)).toBe(true);
  });
  it("rechaza firmas inválidas, viejas o ausentes", () => {
    const t = 1_800_000_000;
    const sig = hmacSha256Hex(secret, `${t}.${body}`);
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, secret, t + 3600)).toBe(false);
    expect(verifyStripeSignature(body + " ", `t=${t},v1=${sig}`, secret, t)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=deadbeef`, secret, t)).toBe(false);
    expect(verifyStripeSignature(body, null, secret, t)).toBe(false);
  });
  it("normaliza eventos de suscripción", () => {
    const ev = normalizeStripeEvent({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_802_592_000 }] }, metadata: { user_id: "u", price_id: "p" } } },
    });
    expect(ev).toMatchObject({ subscriptionRef: "sub_1", status: "active", cancelAtPeriodEnd: true, userId: "u", priceId: "p" });
    expect(ev.periodEnd).toBe(new Date(1_802_592_000_000).toISOString());
    expect(mapStripeStatus("unpaid")).toBe("past_due");
    expect(mapStripeStatus("rare")).toBeNull();
  });
});

describe("Mercado Pago", () => {
  const secret = "mp_secret";
  it("verifica la firma x-signature con el manifiesto oficial", () => {
    const manifest = "id:123abc;request-id:req-1;ts:1700000000;";
    const v1 = hmacSha256Hex(secret, manifest);
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: "req-1", dataId: "123ABC", secret })).toBe(true);
    expect(verifyMercadoPagoSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: "req-2", dataId: "123ABC", secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "1", secret })).toBe(false);
  });
  it("mapea estados y la referencia externa", () => {
    expect(mapMercadoPagoStatus("authorized")).toBe("active");
    expect(mapMercadoPagoStatus("cancelled")).toBe("canceled");
    const u = "11111111-1111-4111-8111-111111111111";
    const p = "00000000-0000-4000-8000-000000000101";
    expect(parseExternalReference(`${u}:${p}`)).toEqual({ userId: u, priceId: p });
    expect(parseExternalReference("hack")).toEqual({ userId: null, priceId: null });
  });
});
