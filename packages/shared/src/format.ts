import { formatDuration, formatPace } from "@runner360/training-engine";

/** Formatos de presentación en es-AR. */

export const LOCALE = "es-AR";

const km = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const km1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const int = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });

export function formatKm(meters: number | null | undefined, opts: { oneDecimal?: boolean } = {}): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return "—";
  return `${(opts.oneDecimal ? km1 : km).format(meters / 1000)} km`;
}

export function formatInt(n: number): string {
  return int.format(n);
}

export function formatPercent(ratio: number | null): string {
  return ratio === null || !Number.isFinite(ratio) ? "—" : pct.format(ratio);
}

export function formatPaceLabel(paceSPerKm: number | null): string {
  const p = formatPace(paceSPerKm);
  return p === "—" ? p : `${p} /km`;
}

export function formatSpeed(kmh: number | null): string {
  return kmh === null ? "—" : `${km1.format(kmh)} km/h`;
}

/** "1 h 05 min" para duraciones de sesión, "45 min" si es menor a una hora. */
export function formatMinutesLong(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

export { formatDuration };

/** Dinero en unidades menores (centavos) → texto localizado. Nunca usa float para sumar. */
export function formatMoney(amountMinor: number | bigint, currency: string): string {
  const minor = typeof amountMinor === "bigint" ? amountMinor : BigInt(Math.trunc(amountMinor));
  const negative = minor < BigInt(0);
  const abs = negative ? -minor : minor;
  const whole = abs / BigInt(100);
  const cents = abs % BigInt(100);
  const nf = new Intl.NumberFormat(LOCALE, { style: "currency", currency, currencyDisplay: "code" });
  const parts = nf.formatToParts(0);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? currency;
  const wholeText = new Intl.NumberFormat(LOCALE).format(whole);
  return `${negative ? "-" : ""}${symbol} ${wholeText},${String(cents).padStart(2, "0")}`;
}

/** Fecha ISO (YYYY-MM-DD) → "lun 5 oct" / "5 de octubre de 2026". Sin conversión de zona horaria. */
export function formatDate(iso: string, style: "short" | "long" | "weekday" = "short"): string {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      : style === "weekday"
        ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
        : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(LOCALE, options).format(d);
}

/** Fecha local de hoy (YYYY-MM-DD) en la zona horaria indicada. */
export function todayIn(timeZone = "America/Argentina/Buenos_Aires", now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Convierte fecha y hora locales de una zona horaria a ISO UTC.
 * Resuelve el desfasaje con Intl (soporta zonas con horario de verano).
 */
export function zonedDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offsetMs = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(instant));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - instant;
  };
  const first = asUtc - offsetMs(asUtc);
  return new Date(asUtc - offsetMs(first)).toISOString();
}
