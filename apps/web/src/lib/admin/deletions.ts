/**
 * Borrar personas y suscripciones desde Administración: textos y la misma regla que aplica la base
 * (public.subscription_deletable), para mostrar el botón solo cuando corresponde. La base decide.
 */

export type DeletionBlock = "self" | "missing" | "admin" | "premium" | "subscription" | "pending";

export const DELETION_BLOCK_MESSAGES: Record<DeletionBlock, string> = {
  self: "No podés borrar tu propia cuenta desde acá.",
  missing: "Esa cuenta ya no existe.",
  admin: "Las cuentas de administrador no se borran desde el panel.",
  premium: "Tiene una suscripción o un plan anual vigente: no se puede borrar hasta que termine.",
  subscription: "Tiene un débito automático activo en Mercado Pago: primero hay que cancelarlo.",
  pending: "Tiene un pago en curso (de los últimos 2 días): esperá a que se resuelva.",
};

export function deletionBlockMessage(reason: string | null): string | null {
  if (!reason) return null;
  return DELETION_BLOCK_MESSAGES[reason as DeletionBlock] ?? "No se puede borrar esta cuenta.";
}

const DAY = 86_400_000;

/** Cancelada o vencida y terminada, asignada a mano y terminada, o pendiente de pago hace más de 2 días. */
export function canDeleteSubscription(s: { status: string; provider: string; current_period_end: string | null; created_at: string }, now: Date): boolean {
  const ended = s.current_period_end !== null && new Date(s.current_period_end) <= now;
  if ((s.status === "cancelled" || s.status === "expired") && (s.current_period_end === null || ended)) return true;
  if (s.provider === "manual" && ended) return true;
  return s.status === "pending" && now.getTime() - new Date(s.created_at).getTime() >= 2 * DAY;
}
