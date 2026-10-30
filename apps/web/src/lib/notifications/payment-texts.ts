/**
 * Textos de las notificaciones de pagos (puros, para poder probarlos). Los motivos de rechazo son los
 * status_detail de Mercado Pago: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/response-handling/collection-results
 */

/** Días de acceso que se mantienen después de un débito rechazado (Mercado Pago reintenta el cobro). */
export const GRACE_DAYS = 5;

/** Donde la persona administra sus suscripciones y cambia la tarjeta en Mercado Pago. */
export const UPDATE_PAYMENT_URL = "https://www.mercadopago.com.ar/subscriptions";

const REASONS: [RegExp, string][] = [
  [/insufficient_amount/, "la tarjeta no tiene fondos suficientes"],
  [/card_expired|expired/, "la tarjeta está vencida"],
  [/bad_filled_date/, "la fecha de vencimiento de la tarjeta no es correcta"],
  [/bad_filled_security_code/, "el código de seguridad de la tarjeta no es correcto"],
  [/bad_filled_card_number|bad_filled_other|invalid_installments/, "hay datos de la tarjeta que no son correctos"],
  [/call_for_authorize/, "el banco pide que autorices el pago"],
  [/card_disabled/, "la tarjeta está deshabilitada"],
  [/max_attempts/, "se superó la cantidad de intentos permitidos con esa tarjeta"],
  [/duplicated_payment/, "el banco lo tomó como un pago duplicado"],
  [/high_risk|blacklist|other_reason|rejected_by_bank|by_bank/, "el banco rechazó el pago"],
];

/** Motivo en lenguaje claro ("la tarjeta no tiene fondos suficientes"). */
export function failureReason(code: string | null | undefined): string {
  const c = (code ?? "").toLowerCase();
  return REASONS.find(([re]) => re.test(c))?.[1] ?? "el medio de pago fue rechazado";
}

/** Fin del período de gracia a partir del rechazo. */
export function graceEnd(from: Date): Date {
  return new Date(from.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/** "4 de noviembre" en hora argentina. */
const day = (d: Date | string) => new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "long" }).format(new Date(d));

export const userTexts = {
  failed: (code: string | null | undefined, graceUntil: Date | string) =>
    `No pudimos cobrar tu suscripción porque ${failureReason(code)}. Actualizá tu medio de pago en Mercado Pago para no perder el acceso: lo mantenemos hasta el ${day(graceUntil)} mientras se reintenta el cobro.`,
  recovered: () => "¡Listo! Ya se acreditó el pago de tu suscripción. Está todo en orden.",
  ended: () =>
    "No pudimos cobrar tu suscripción y terminó el plazo para regularizarla, así que pausamos el acceso Premium. Tu historial se conserva: actualizá tu medio de pago o suscribite de nuevo para seguir.",
};

/** "$ 20.000,00 ARS" (montos en unidades menores). */
export function formatAmount(amountMinor: number | null | undefined, currency: string | null | undefined): string {
  if (amountMinor === null || amountMinor === undefined) return "monto sin informar";
  const n = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100);
  return `$ ${n}${currency ? ` ${currency}` : ""}`;
}

/** "30/10/2026 14:05" en hora argentina. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(",", "");
}

export type PaymentFacts = {
  name: string;
  email: string;
  plan: string;
  amountMinor: number | null;
  currency: string | null;
  at: string;
  firstPayment: boolean;
  providerPaymentId: string;
  failureCode?: string | null;
};

export const adminTexts = {
  approved: (f: PaymentFacts) => ({
    title: `Pago acreditado · ${f.plan}`,
    body: `${f.name} (${f.email}) · ${f.plan} · ${formatAmount(f.amountMinor, f.currency)} · ${formatDateTime(f.at)} · ${f.firstPayment ? "Primer pago" : "Renovación"} · Pago MP ${f.providerPaymentId}`,
  }),
  failed: (f: PaymentFacts) => ({
    title: `Débito rechazado · ${f.plan}`,
    body: `${f.name} (${f.email}) · ${f.plan} · ${formatAmount(f.amountMinor, f.currency)} · ${formatDateTime(f.at)} · Motivo: ${failureReason(f.failureCode)} · Pago MP ${f.providerPaymentId}`,
  }),
  recovered: (f: PaymentFacts) => ({
    title: `Pago regularizado · ${f.plan}`,
    body: `${f.name} (${f.email}) · ${f.plan} · ${formatAmount(f.amountMinor, f.currency)} · ${formatDateTime(f.at)} · Renovación (regularizó un débito rechazado) · Pago MP ${f.providerPaymentId}`,
  }),
  ended: (f: Pick<PaymentFacts, "name" | "email" | "plan">) => ({
    title: `Acceso cortado · ${f.plan}`,
    body: `${f.name} (${f.email}) no regularizó el débito en ${GRACE_DAYS} días: se pausó su acceso Premium.`,
  }),
};
