import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAdminEmail } from "@/lib/notifications/email";
import { adminTexts, failureReason, formatAmount, GRACE_DAYS, graceEnd, userTexts } from "@/lib/notifications/payment-texts";
import { mapMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { debitStatus } from "@/lib/payments/process";

describe("motivo del rechazo en lenguaje claro", () => {
  it("traduce los códigos de Mercado Pago", () => {
    expect(failureReason("cc_rejected_insufficient_amount")).toBe("la tarjeta no tiene fondos suficientes");
    expect(failureReason("cc_rejected_card_disabled")).toBe("la tarjeta está deshabilitada");
    expect(failureReason("cc_rejected_bad_filled_date")).toBe("la fecha de vencimiento de la tarjeta no es correcta");
    expect(failureReason("cc_rejected_call_for_authorize")).toBe("el banco pide que autorices el pago");
    expect(failureReason("cc_rejected_high_risk")).toBe("el banco rechazó el pago");
    expect(failureReason("cc_rejected_other_reason")).toBe("el banco rechazó el pago");
    expect(failureReason(null)).toBe("el medio de pago fue rechazado");
    expect(failureReason("algo_nuevo")).toBe("el medio de pago fue rechazado");
  });

  it("mensaje al usuario: motivo, qué hacer y hasta cuándo conserva el acceso", () => {
    const m = userTexts.failed("cc_rejected_insufficient_amount", "2026-11-04T15:00:00.000Z");
    expect(m).toContain("No pudimos cobrar tu suscripción porque la tarjeta no tiene fondos suficientes.");
    expect(m).toContain("Actualizá tu medio de pago");
    expect(m).toContain("hasta el 4 de noviembre");
    expect(userTexts.recovered()).toMatch(/todo en orden/i);
  });
});

describe("notificación al admin", () => {
  const facts = { name: "Ana", email: "ana@test.local", plan: "Premium mensual", amountMinor: 2000000, currency: "ARS", at: "2026-10-30T17:05:00.000Z", firstPayment: true, providerPaymentId: "7001", failureCode: "cc_rejected_insufficient_amount" };
  it("pago acreditado: usuario, plan, monto, fecha, primer pago o renovación e ID", () => {
    const t = adminTexts.approved(facts);
    expect(t.title).toBe("Pago acreditado · Premium mensual");
    for (const part of ["Ana (ana@test.local)", "Premium mensual", "$ 20.000,00 ARS", "30/10/2026 14:05", "Primer pago", "Pago MP 7001"]) expect(t.body).toContain(part);
    expect(adminTexts.approved({ ...facts, firstPayment: false }).body).toContain("Renovación");
  });
  it("débito rechazado: con el motivo", () => {
    expect(adminTexts.failed(facts).body).toContain("Motivo: la tarjeta no tiene fondos suficientes");
    expect(formatAmount(null, null)).toBe("monto sin informar");
  });
});

describe("gracia de un débito rechazado", () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  it(`dura ${GRACE_DAYS} días`, () => {
    expect(GRACE_DAYS).toBe(5);
    expect(graceEnd(now).toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });
  it("rechazado: pasa a past_due con gracia; un reintento rechazado no la extiende", () => {
    expect(debitStatus({ status: "active", grace_until: null }, "active", { status: "rejected" }, now)).toEqual({ status: "past_due", graceUntil: "2026-11-04T12:00:00.000Z", recovered: false });
    const open = { status: "past_due", grace_until: "2026-11-02T12:00:00.000Z" };
    expect(debitStatus(open, "active", { status: "rejected" }, now).graceUntil).toBe("2026-11-02T12:00:00.000Z");
  });
  it("aprobado: vuelve a activa y se marca como regularizada", () => {
    expect(debitStatus({ status: "past_due", grace_until: "2026-11-02T12:00:00.000Z" }, "active", { status: "approved" }, now)).toEqual({ status: "active", graceUntil: null, recovered: true });
    expect(debitStatus({ status: "expired", grace_until: null }, "active", { status: "approved" }, now).recovered).toBe(true);
    expect(debitStatus({ status: "active", grace_until: null }, "active", { status: "approved" }, now).recovered).toBe(false);
  });
  it("un aviso de 'autorizada' sin débito no saca de la gracia ni reactiva un acceso cortado", () => {
    expect(debitStatus({ status: "past_due", grace_until: "2026-11-02T12:00:00.000Z" }, "active", null, now)).toEqual({ recovered: false });
    expect(debitStatus({ status: "expired", grace_until: null }, "active", undefined, now)).toEqual({ recovered: false });
    expect(debitStatus(null, "active", null, now).status).toBe("active");
    expect(debitStatus({ status: "past_due", grace_until: null }, "cancelled", { status: "rejected" }, now).status).toBe("cancelled");
  });
});

describe("motivo en el débito de Mercado Pago", () => {
  const ap = { id: 7002, preapproval_id: "pre-1", status: "processed", transaction_amount: 20000, currency_id: "ARS", debit_date: "2026-11-01T10:00:00.000-03:00" };
  it("toma el status_detail del pago rechazado", () => {
    expect(mapMercadoPagoPayment({ ...ap, payment: { id: 5, status: "rejected", status_detail: "cc_rejected_insufficient_amount" } })?.failureCode).toBe("cc_rejected_insufficient_amount");
    expect(mapMercadoPagoPayment({ ...ap, rejection_code: "cc_rejected_card_disabled", payment: { id: 5, status: "rejected" } })?.failureCode).toBe("cc_rejected_card_disabled");
    expect(mapMercadoPagoPayment({ ...ap, payment: { id: 5, status: "approved", status_detail: "accredited" } })?.failureCode).toBeUndefined();
  });
});

describe("mail al admin", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("sin clave no se envía", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const f = vi.fn();
    expect(await sendAdminEmail({ subject: "x", text: "y" }, f as unknown as typeof fetch)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("con clave: va a la dirección del admin, con el link", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_1234567890");
    const f = vi.fn(async () => ({ ok: true }) as Response);
    expect(await sendAdminEmail({ subject: "Pago acreditado", text: "Ana pagó", link: "https://runner360.vercel.app/admin/notificaciones" }, f as unknown as typeof fetch)).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init.body));
    expect(body.to).toEqual(["alejorodriguezaguirrepf@gmail.com"]);
    expect(body.text).toContain("https://runner360.vercel.app/admin/notificaciones");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_1234567890");
  });
});
