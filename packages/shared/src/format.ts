/** Utilidades de formato y parseo para es-AR. Todas son funciones puras. */

const LOCALE = "es-AR";

/** Formatea segundos como h:mm:ss o m:ss. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Formatea un ritmo en segundos por km como m:ss /km. */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "—";
  return `${formatDuration(secondsPerKm)} /km`;
}

/** Formatea metros como kilómetros con separador decimal argentino. */
export function formatKm(meters: number, fractionDigits = 2): string {
  if (!Number.isFinite(meters)) return "—";
  return `${new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(meters / 1000)} km`;
}

export function formatSpeedKmh(kmh: number | null | undefined): string {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return "—";
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(kmh)} km/h`;
}

/** Formatea un importe en unidades menores (centavos) evitando errores de punto flotante en el cálculo. */
export function formatMoney(amountMinor: number | bigint, currency: string): string {
  const minor = typeof amountMinor === "bigint" ? amountMinor : BigInt(Math.round(amountMinor));
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const units = abs / 100n;
  const cents = abs % 100n;
  // Intl recibe una cadena decimal exacta, no un float derivado de división.
  const decimal = `${negative ? "-" : ""}${units.toString()}.${cents.toString().padStart(2, "0")}`;
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(
    decimal as unknown as number,
  );
}

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof iso === "string" ? parseIsoDate(iso) : iso;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(d);
}

/** Interpreta "YYYY-MM-DD" como fecha calendario en UTC (sin corrimientos por zona horaria). */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value.length > 10) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/**
 * Parsea una duración escrita por el usuario: "45" (minutos), "45:30" (mm:ss) o "1:02:03" (h:mm:ss).
 * Devuelve segundos enteros o null si es inválida.
 */
export function parseDuration(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 60;
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (parts.length === 2) {
    const [m, s] = nums as [number, number];
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = nums as [number, number, number];
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Parsea kilómetros escritos con coma o punto ("10,5", "10.5") y devuelve metros enteros.
 * Se usa aritmética de cadenas para evitar errores de redondeo binario (p. ej. 0,1 + 0,2).
 */
export function parseKmToMeters(input: string): number | null {
  const raw = input.trim().replace(",", ".");
  const m = /^(\d{1,4})(?:\.(\d{1,3}))?$/.exec(raw);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = (m[2] ?? "").padEnd(3, "0");
  return whole * 1000 + Number(frac);
}
