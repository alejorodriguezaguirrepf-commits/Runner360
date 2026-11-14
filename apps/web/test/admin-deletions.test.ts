import { describe, expect, it } from "vitest";
import { canDeleteSubscription, deletionBlockMessage } from "@/lib/admin/deletions";

const now = new Date("2026-11-14T12:00:00Z");
const base = { provider: "mercadopago", created_at: "2026-01-01T00:00:00Z" };

describe("Administración: qué suscripciones se pueden borrar", () => {
  it("cancelada o vencida y terminada: sí", () => {
    expect(canDeleteSubscription({ ...base, status: "cancelled", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe(true);
    expect(canDeleteSubscription({ ...base, status: "expired", current_period_end: null }, now)).toBe(true);
  });
  it("cancelada que todavía da acceso, activa o en gracia: no", () => {
    expect(canDeleteSubscription({ ...base, status: "cancelled", current_period_end: "2026-12-01T00:00:00Z" }, now)).toBe(false);
    expect(canDeleteSubscription({ ...base, status: "active", current_period_end: "2026-12-01T00:00:00Z" }, now)).toBe(false);
    expect(canDeleteSubscription({ ...base, status: "active", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(canDeleteSubscription({ ...base, status: "past_due", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });
  it("asignada a mano y terminada: sí", () => {
    expect(canDeleteSubscription({ ...base, provider: "manual", status: "active", current_period_end: "2026-10-01T00:00:00Z" }, now)).toBe(true);
  });
  it("pendiente de pago: solo si pasaron 2 días", () => {
    expect(canDeleteSubscription({ ...base, status: "pending", current_period_end: null, created_at: "2026-11-14T00:00:00Z" }, now)).toBe(false);
    expect(canDeleteSubscription({ ...base, status: "pending", current_period_end: null, created_at: "2026-11-10T00:00:00Z" }, now)).toBe(true);
  });
});

describe("Administración: por qué no se puede borrar una cuenta", () => {
  it("explica cada caso", () => {
    expect(deletionBlockMessage(null)).toBeNull();
    expect(deletionBlockMessage("premium")).toContain("vigente");
    expect(deletionBlockMessage("subscription")).toContain("cancelarlo");
    expect(deletionBlockMessage("admin")).toContain("administrador");
    expect(deletionBlockMessage("otro")).toBe("No se puede borrar esta cuenta.");
  });
});
