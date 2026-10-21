/**
 * Plan anual (pago único por 12 meses, sin renovación automática). Funciones puras: período que
 * cubre una compra, ahorro frente a la mensual y aviso de vencimiento. Se prueban en test/annual.test.ts.
 */

export const ANNUAL_MONTHS = 12;
/** Días antes del vencimiento en los que se avisa. */
export const EXPIRY_NOTICE_DAYS = 15;

function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

/**
 * Período de una compra anual. Si todavía tiene un anual vigente (renovación anticipada), el nuevo
 * empieza cuando termina el anterior: no se pierde ningún día.
 */
export function prepaidPeriod(paidAt: Date, currentEnd: Date | null, months = ANNUAL_MONTHS): { start: Date; end: Date } {
  const start = currentEnd && currentEnd > paidAt ? currentEnd : paidAt;
  return { start, end: addMonths(start, months) };
}

/** Ahorro del anual frente a pagar 12 meses de la mensual (misma moneda). null si no hay ahorro. */
export function annualSavings(monthlyMinor: number | null | undefined, yearlyMinor: number | null | undefined): { amountMinor: number; pct: number } | null {
  if (!monthlyMinor || !yearlyMinor) return null;
  const twelve = monthlyMinor * 12;
  if (yearlyMinor >= twelve) return null;
  return { amountMinor: twelve - yearlyMinor, pct: Math.round(((twelve - yearlyMinor) / twelve) * 100) };
}

/** Días que faltan para el vencimiento si corresponde avisar (≤ 15), o null. */
export function expiryNoticeDays(end: Date | null, now: Date): number | null {
  if (!end || end <= now) return null;
  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  return days <= EXPIRY_NOTICE_DAYS ? days : null;
}
