/**
 * Formatos de la biblioteca (es-AR, sistema métrico):
 * duraciones en h mm' (p. ej. 36', 1 h 05'), ritmos en mm:ss/km y km con coma decimal.
 */
const kmFormat = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const km1Format = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Minutos (pueden tener medio minuto) → 36' · 37' 30" · 1 h 05'. Con `round`, al minuto (totales). */
export function formatMinutes(minutes: number | null | undefined, opts: { round?: boolean } = {}): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return "—";
  const totalS = opts.round ? Math.round(minutes) * 60 : Math.round(minutes * 60);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const sec = s ? ` ${String(s).padStart(2, "0")}"` : "";
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}'${sec}` : `${m}'${sec}`;
}

/** Km tal cual el contenido (hasta 2 decimales): 3,67 km. */
export function formatKmValue(km: number | null | undefined, opts: { oneDecimal?: boolean } = {}): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return "—";
  return `${(opts.oneDecimal ? km1Format : kmFormat).format(km)} km`;
}

/** Ritmo en segundos por km → 5:07/km. */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm === null || secondsPerKm === undefined || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "—";
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}/km`;
}

/** Segundos → 25:30 o 1:45:10. */
export function formatClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
