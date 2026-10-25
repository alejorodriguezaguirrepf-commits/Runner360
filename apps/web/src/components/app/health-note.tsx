/** Aviso general al pie de las secciones educativas (Aprender, Hidratación): breve y discreto. */
export const HEALTH_NOTE = "Contenido informativo. No reemplaza la consulta con un profesional de la salud.";

export function HealthNote() {
  return <p className="mt-6 border-t border-line pt-3 text-xs text-muted">{HEALTH_NOTE}</p>;
}
