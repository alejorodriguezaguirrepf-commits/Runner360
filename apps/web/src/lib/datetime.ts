/** Une "YYYY-MM-DDTHH:mm" (input datetime-local) con el desfase del navegador en minutos (Date#getTimezoneOffset). */
export function localInputToIso(local: string, tzOffsetMinutes: number | null): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const off = tzOffsetMinutes != null && Number.isInteger(tzOffsetMinutes) && Math.abs(tzOffsetMinutes) <= 14 * 60 ? tzOffsetMinutes : 180;
  const sign = off <= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${local}:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
