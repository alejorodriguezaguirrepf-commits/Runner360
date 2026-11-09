import { describe, expect, it } from "vitest";
import { debitStatus, nextDate, subscriptionOrigin, subscriptionState, type Subscriber } from "@/lib/admin/subscriptions";

const NOW = new Date("2026-11-09T12:00:00Z");
const base: Subscriber = {
  user_id: "u1",
  email: "a@b.com",
  display_name: null,
  subscription_id: "s1",
  plan: "Premium",
  billing_interval: "month",
  provider: "mercadopago",
  status: "active",
  started_at: "2026-10-01T12:00:00Z",
  current_period_end: "2026-12-01T12:00:00Z",
  cancel_at_period_end: false,
  grace_until: null,
  subscribed_at: "2026-10-01T11:00:00Z",
  approved_count: 2,
  total_paid_minor: 4000000,
  paid_currency: "ARS",
  last_paid_at: "2026-11-01T12:00:00Z",
  last_paid_minor: 2000000,
};

describe("panel de suscripciones", () => {
  it("distingue quién compró, quién la tiene asignada a mano y quién nunca pagó", () => {
    expect(subscriptionOrigin(base)).toBe("paid");
    expect(subscriptionOrigin({ ...base, provider: "manual", approved_count: 0 })).toBe("manual");
    expect(subscriptionOrigin({ ...base, status: "pending", approved_count: 0, started_at: null })).toBe("unpaid");
    // Pagó aunque el débito todavía no se haya registrado (Mercado Pago ya la activó).
    expect(subscriptionOrigin({ ...base, approved_count: 0 })).toBe("paid");
  });

  it("estado de la suscripción", () => {
    expect(subscriptionState(base, NOW).label).toBe("Activa");
    expect(subscriptionState({ ...base, current_period_end: "2026-11-01T00:00:00Z" }, NOW).label).toBe("Vencida");
    expect(subscriptionState({ ...base, status: "past_due" }, NOW).label).toBe("Cobro rechazado (en gracia)");
    expect(subscriptionState({ ...base, status: "cancelled" }, NOW).label).toBe("Cancelada (con acceso)");
    expect(subscriptionState({ ...base, status: "pending" }, NOW).label).toBe("Pendiente de pago");
  });

  it("próximo débito, acceso hasta o fin de la gracia", () => {
    expect(nextDate(base, NOW)).toEqual({ label: "Próximo débito", at: "2026-12-01T12:00:00Z" });
    expect(nextDate({ ...base, cancel_at_period_end: true }, NOW)?.label).toBe("Acceso hasta");
    expect(nextDate({ ...base, billing_interval: "year" }, NOW)?.label).toBe("Acceso hasta");
    expect(nextDate({ ...base, provider: "manual" }, NOW)?.label).toBe("Acceso hasta");
    expect(nextDate({ ...base, status: "past_due", grace_until: "2026-11-12T12:00:00Z" }, NOW)).toEqual({ label: "En gracia hasta", at: "2026-11-12T12:00:00Z" });
    expect(nextDate({ ...base, status: "expired", current_period_end: "2026-11-01T00:00:00Z" }, NOW)?.label).toBe("Terminó el");
    expect(nextDate({ ...base, current_period_end: null }, NOW)).toBeNull();
  });

  it("estado de cada débito", () => {
    expect(debitStatus("approved").label).toBe("Aprobado");
    expect(debitStatus("rejected").tone).toBe("danger");
    expect(debitStatus("refunded").label).toBe("Devuelto");
  });
});
