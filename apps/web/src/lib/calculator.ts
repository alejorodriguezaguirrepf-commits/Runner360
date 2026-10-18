/**
 * Calculadora de porcentajes de ritmo. Funciones puras.
 * El 100 % es el ritmo del test; el porcentaje es sobre la VELOCIDAD: al 50 % se corre a la mitad
 * de velocidad, o sea que cada distancia lleva el doble de tiempo.
 */

/** Porcentajes de la tabla: 100 % al 50 %, de a 5 %. */
export const PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50] as const;

/** "2,4" o "2.4" → 2,4 km. Entre 0,1 y 100 km. */
export function parseKm(input: string): number | null {
  const t = input.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const km = Number(t);
  return km >= 0.1 && km <= 100 ? km : null;
}

/** "mm:ss" o "hh:mm:ss" → segundos. Los segundos (y los minutos con horas) van de 0 a 59. */
export function parseClock(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  const s = nums[nums.length - 1]!;
  const m = nums[nums.length - 2]!;
  const h = parts.length === 3 ? nums[0]! : 0;
  if (s > 59 || (parts.length === 3 && m > 59)) return null;
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

/**
 * Distancia a calcular → metros. Acepta "400", "400 m", "1000m", "1,5 km", "5km".
 * Un número sin unidad menor que 100 se toma en km (ej. "5" = 5 km); desde 100, en metros.
 */
export function parseDistance(input: string): number | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*(m|km)?$/i.exec(input.trim());
  if (!m) return null;
  const n = Number(m[1]!.replace(",", "."));
  const unit = m[2]?.toLowerCase() ?? (n < 100 ? "km" : "m");
  const meters = Math.round(unit === "km" ? n * 1000 : n);
  return meters >= 50 && meters <= 100_000 ? meters : null;
}

/** Tiempo (s) para recorrer `meters` al `pct` % de la velocidad del test. */
export function timeAt(test: { meters: number; seconds: number }, meters: number, pct: number): number {
  if (!(test.meters > 0) || !(test.seconds > 0) || !(pct > 0)) throw new Error("Datos inválidos");
  return (test.seconds * (meters / test.meters)) / (pct / 100);
}

/** Ritmo (s por km) al `pct` % de la velocidad del test. */
export function paceAt(test: { meters: number; seconds: number }, pct: number): number {
  return timeAt(test, 1000, pct);
}

/** Segundos → "m:ss" (o "h:mm:ss" desde una hora), redondeado al segundo. */
export function formatClock(seconds: number): string {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** 400 → "400 m"; 1000 → "1 km"; 1500 → "1,5 km". */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(meters / 1000)} km`;
}
