import { toLocalDateKey } from "@runner360/training-engine";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del usuario. */
export function todayKey(timeZone: string): string {
  try {
    return toLocalDateKey(new Date(), timeZone);
  } catch {
    return toLocalDateKey(new Date(), "America/Argentina/Buenos_Aires");
  }
}
