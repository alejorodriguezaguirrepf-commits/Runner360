/**
 * Panel de suscripciones (admin): de dónde viene cada suscripción, en qué estado está y cuál es el
 * próximo cobro o vencimiento. Funciones puras (se prueban en test/admin-subscriptions.test.ts).
 */

export type Subscriber = {
  user_id: string;
  email: string;
  display_name: string | null;
  subscription_id: string;
  plan: string;
  billing_interval: string | null;
  provider: string;
  status: string;
  started_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_until: string | null;
  subscribed_at: string;
  approved_count: number;
  total_paid_minor: number | null;
  paid_currency: string | null;
  last_paid_at: string | null;
  last_paid_minor: number | null;
};

export type Debit = {
  payment_id: string;
  provider: string;
  provider_payment_id: string;
  status: string;
  amount_minor: number | null;
  currency: string | null;
  paid_at: string;
  failure_code: string | null;
  user_id: string;
  email: string;
  display_name: string | null;
  total_count: number;
};

type Tone = "success" | "warning" | "danger" | "neutral";

/** Compró (pagó al menos una vez), asignada a mano por un admin, o se anotó y nunca pagó. */
export type Origin = "paid" | "manual" | "unpaid";

export function subscriptionOrigin(s: Pick<Subscriber, "provider" | "approved_count" | "started_at" | "status">): Origin {
  if (s.provider === "manual") return "manual";
  if (s.approved_count > 0 || (s.started_at !== null && s.status !== "pending")) return "paid";
  return "unpaid";
}

export const ORIGIN_LABELS: Record<Origin, { label: string; tone: Tone }> = {
  paid: { label: "Compró", tone: "success" },
  manual: { label: "Asignada a mano", tone: "neutral" },
  unpaid: { label: "Sin pago", tone: "warning" },
};

const PROVIDERS: Record<string, string> = { mercadopago: "Mercado Pago", stripe: "Stripe", apple: "App Store", google: "Google Play", manual: "Asignada por un admin" };
export function providerLabel(p: string): string {
  return PROVIDERS[p] ?? p;
}

/** Estado de la suscripción para el admin. "now" se pasa para poder probarlo. */
export function subscriptionState(s: Pick<Subscriber, "status" | "current_period_end">, now: Date): { label: string; tone: Tone } {
  const ended = s.current_period_end !== null && new Date(s.current_period_end) <= now;
  switch (s.status) {
    case "active":
    case "trialing":
      return ended ? { label: "Vencida", tone: "danger" } : { label: s.status === "trialing" ? "En prueba" : "Activa", tone: "success" };
    case "past_due":
      return { label: "Cobro rechazado (en gracia)", tone: "warning" };
    case "cancelled":
      return ended ? { label: "Cancelada", tone: "neutral" } : { label: "Cancelada (con acceso)", tone: "warning" };
    case "pending":
      return { label: "Pendiente de pago", tone: "warning" };
    default:
      return { label: "Vencida", tone: "danger" };
  }
}

/**
 * Qué fecha importa mirar: el próximo débito (mensual por Mercado Pago, al día), hasta cuándo tiene
 * acceso (anual, asignada a mano o cancelada) o el fin de la gracia (débito rechazado).
 */
export function nextDate(s: Subscriber, now: Date): { label: string; at: string } | null {
  if (s.status === "past_due" && s.grace_until) return { label: "En gracia hasta", at: s.grace_until };
  if (!s.current_period_end) return null;
  const future = new Date(s.current_period_end) > now;
  const recurring = s.provider === "mercadopago" && s.billing_interval !== "year";
  if (future && recurring && (s.status === "active" || s.status === "trialing") && !s.cancel_at_period_end) {
    return { label: "Próximo débito", at: s.current_period_end };
  }
  return { label: future ? "Acceso hasta" : "Terminó el", at: s.current_period_end };
}

export const DEBIT_STATUS: Record<string, { label: string; tone: Tone }> = {
  approved: { label: "Aprobado", tone: "success" },
  rejected: { label: "Rechazado", tone: "danger" },
  pending: { label: "Pendiente", tone: "warning" },
  refunded: { label: "Devuelto", tone: "neutral" },
};
export function debitStatus(status: string): { label: string; tone: Tone } {
  return DEBIT_STATUS[status] ?? { label: status, tone: "neutral" };
}

export function intervalLabel(interval: string | null): string {
  return interval === "year" ? "anual" : interval === "month" ? "mensual" : "";
}
