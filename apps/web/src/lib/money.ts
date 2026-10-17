/**
 * Conversión y formato de precios. Funciones puras: el dinero se maneja en unidades menores enteras.
 */

/** Importe en pesos (unidades menores) equivalente a un importe en dólares, redondeado al peso hacia arriba. */
export function arsMinorFromUsd(usdMinor: number, rate: number): number {
  if (!Number.isInteger(usdMinor) || usdMinor < 0) throw new Error("Importe en dólares inválido");
  if (!(rate > 0) || !Number.isFinite(rate)) throw new Error("Cotización inválida");
  // La cotización se usa con 4 decimales, en enteros, para evitar errores de coma flotante.
  const rate4 = Math.round(rate * 10_000);
  const pesos = Math.ceil((usdMinor * rate4) / 1_000_000);
  return pesos * 100;
}

const AR_INT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const AR_2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pesos sin centavos: 2999900 → "$ 29.999". */
export function formatArs(amountMinor: number): string {
  return `$ ${AR_INT.format(Math.round(amountMinor / 100))}`;
}

/** Dólares: 2000 → "US$ 20"; 1999 → "US$ 19,99". */
export function formatUsd(amountMinor: number): string {
  return `US$ ${amountMinor % 100 === 0 ? AR_INT.format(amountMinor / 100) : AR_2.format(amountMinor / 100)}`;
}

/** Precio de lista en su moneda: USD con el formato de arriba; otras monedas, con su código. */
export function formatListPrice(amountMinor: number, currency: string): string {
  if (currency === "USD") return formatUsd(amountMinor);
  if (currency === "ARS") return formatArs(amountMinor);
  return `${currency} ${AR_2.format(amountMinor / 100)}`;
}
