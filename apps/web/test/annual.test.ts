import { describe, expect, it } from "vitest";
import { annualSavings, expiryNoticeDays, prepaidPeriod } from "@/lib/payments/annual";
import { annualPreference, mapMercadoPagoOneOff } from "@/lib/payments/mercadopago";

const d = (s: string) => new Date(s);

describe("plan anual: período de la compra", () => {
  it("12 meses desde el pago", () => {
    const { start, end } = prepaidPeriod(d("2026-10-21T15:00:00Z"), null);
    expect(start.toISOString()).toBe("2026-10-21T15:00:00.000Z");
    expect(end.toISOString()).toBe("2027-10-21T15:00:00.000Z");
  });
  it("renovación anticipada: empieza cuando termina el anual vigente (no se pierden días)", () => {
    const { start, end } = prepaidPeriod(d("2027-10-10T12:00:00Z"), d("2027-10-21T15:00:00Z"));
    expect(start.toISOString()).toBe("2027-10-21T15:00:00.000Z");
    expect(end.toISOString()).toBe("2028-10-21T15:00:00.000Z");
  });
  it("un anual ya vencido no corre la fecha", () => {
    expect(prepaidPeriod(d("2027-12-01T00:00:00Z"), d("2027-10-21T00:00:00Z")).start.toISOString()).toBe("2027-12-01T00:00:00.000Z");
  });
  it("fin de mes: 29 de febrero → 28 de febrero del año siguiente", () => {
    expect(prepaidPeriod(d("2028-02-29T10:00:00Z"), null).end.toISOString()).toBe("2029-02-28T10:00:00.000Z");
  });
});

describe("plan anual: ahorro y aviso de vencimiento", () => {
  it("USD 180 contra 12 × USD 20 = ahorro de USD 60 (25 %)", () => {
    expect(annualSavings(2000, 18000)).toEqual({ amountMinor: 6000, pct: 25 });
    expect(annualSavings(2000, 24000)).toBeNull();
    expect(annualSavings(null, 18000)).toBeNull();
  });
  it("avisa desde 15 días antes y no después de vencido", () => {
    const now = d("2027-10-01T12:00:00Z");
    expect(expiryNoticeDays(d("2027-10-16T12:00:00Z"), now)).toBe(15);
    expect(expiryNoticeDays(d("2027-10-02T00:00:00Z"), now)).toBe(1);
    expect(expiryNoticeDays(d("2027-10-17T12:00:01Z"), now)).toBeNull();
    expect(expiryNoticeDays(d("2027-09-30T12:00:00Z"), now)).toBeNull();
    expect(expiryNoticeDays(null, now)).toBeNull();
  });
});

describe("Mercado Pago: pago único del anual", () => {
  it("aprobado → acceso activo y pago registrado en centavos", () => {
    const r = mapMercadoPagoOneOff({ id: 123, status: "approved", transaction_amount: 250000.5, currency_id: "ARS", date_approved: "2026-10-21T15:00:00Z" });
    expect(r.status).toBe("active");
    expect(r.payment).toEqual({ providerPaymentId: "123", status: "approved", amountMinor: 25000050, currency: "ARS", paidAt: "2026-10-21T15:00:00Z" });
  });
  it("en proceso → pendiente; rechazado → se ignora; devuelto → se corta el acceso", () => {
    expect(mapMercadoPagoOneOff({ id: 1, status: "in_process" })).toEqual({ status: "pending", payment: null });
    expect(mapMercadoPagoOneOff({ id: 1, status: "rejected" }).status).toBeNull();
    const refund = mapMercadoPagoOneOff({ id: 1, status: "refunded", transaction_amount: 10, currency_id: "ARS", date_last_updated: "2026-11-01T00:00:00Z" });
    expect(refund.status).toBe("cancelled");
    expect(refund.payment?.status).toBe("refunded");
  });
  it("preferencia: un ítem en pesos, referencia de usuario y producto, vuelta a la app", () => {
    const p = annualPreference({
      userId: "11111111-1111-4111-8111-111111111111",
      email: "a@b.com",
      productCode: "premium_yearly",
      productName: "Premium anual",
      amount: 250000,
      currency: "ARS",
      successUrl: "https://runner360.vercel.app/suscripcion?estado=procesando",
      cancelUrl: "https://runner360.vercel.app/suscripcion",
    });
    expect(p.items).toEqual([{ id: "premium_yearly", title: "RUNNER 360 · Premium anual (12 meses)", quantity: 1, unit_price: 250000, currency_id: "ARS" }]);
    expect(p.external_reference).toBe("11111111-1111-4111-8111-111111111111:premium_yearly");
    expect(p.back_urls.success).toMatch(/^https:\/\/runner360\.vercel\.app\//);
    expect(p.auto_return).toBe("approved");
  });
});
