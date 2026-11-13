/**
 * Partes de Runnie que usa también el chat en el navegador (sin las instrucciones del asistente).
 * Funciones puras (se prueban en test/runnie.test.ts).
 */

/** Cuántos mensajes previos de la conversación se mandan como contexto, y el largo máximo de cada uno. */
export const HISTORY_MAX_MESSAGES = 12;
export const MESSAGE_MAX_CHARS = 1000;

/** Secciones de la app a las que Runnie puede mandar (se muestran como enlaces en el chat). */
export const APP_LINKS: Record<string, string> = {
  "/inicio": "Inicio: resumen del día y del plan",
  "/hoy": "Hoy: el wellness y la sesión del día, con los tiempos para anotar y guardar",
  "/plan": "Mi plan: calendario semana a semana, registro de cada sesión y descarga de la semana en PDF",
  "/planes": "Planes: la biblioteca para elegir plan (5K, 10K, 21K y 42K)",
  "/progreso": "Progreso: estadísticas, wellness, carga y parciales",
  "/entrenamientos": "Historial: los entrenamientos guardados",
  "/calculadora": "Test/%: cargar el test y ver los parciales del 50 al 100 %",
  "/pulsaciones": "Pulsaciones: medir las pulsaciones con la cámara del celular",
  "/aprender": "Aprender: contenido educativo",
  "/hidratacion": "Hidratación (con suscripción)",
  "/competencias": "Competencias (con suscripción)",
  "/suscripcion": "Suscripción: planes pagos, pagos y cancelación",
  "/perfil": "Perfil: datos personales, correos, descargar o borrar la cuenta",
  "/instalar": "Instalar la app en el celular o la computadora",
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type Segment = { text: string; href?: string };

/** Parte una respuesta en texto y enlaces a secciones conocidas de la app (/planes, /suscripcion, /aprender/nota…). */
export function linkify(text: string): Segment[] {
  const paths = Object.keys(APP_LINKS).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(\\/aprender\\/[a-z0-9-]+|${paths.map((p) => p.replace("/", "\\/")).join("|")})(?![\\w-])`, "g");
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    // Solo rutas sueltas, no partes de una dirección web (runner360.ar/planes).
    if (i > 0 && /[\w.]/.test(text[i - 1]!)) continue;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
