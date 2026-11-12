/**
 * Partes de Runnie que usa también el chat en el navegador (sin las instrucciones del asistente).
 * Funciones puras (se prueban en test/runnie.test.ts).
 */

/** Runnie es parte de la suscripción: 30 mensajes por día (el que vale es el de la base: runnie_daily_limit). */
export const RUNNIE_LIMITS = { free: 0, premium: 30 } as const;
/** Cuántos mensajes previos de la conversación se mandan como contexto, y el largo máximo de cada uno. */
export const HISTORY_MAX_MESSAGES = 12;
export const MESSAGE_MAX_CHARS = 1000;

/** Secciones de la app a las que Runnie puede mandar (se muestran como enlaces en el chat). */
export const APP_LINKS: Record<string, string> = {
  "/inicio": "Inicio: resumen del día y del plan",
  "/hoy": "Hoy: la sesión del día",
  "/plan": "Mi plan: calendario semana a semana",
  "/planes": "Planes: la biblioteca para elegir plan (5K, 10K, 21K y 42K)",
  "/registrar": "Registrar: cargar un entrenamiento",
  "/progreso": "Progreso: estadísticas e historial",
  "/calculadora": "Test/% (parciales por porcentaje)",
  "/aprender": "Aprender: contenido educativo",
  "/hidratacion": "Hidratación (con suscripción)",
  "/competencias": "Competencias (con suscripción)",
  "/suscripcion": "Suscripción: planes pagos, pagos y cancelación",
  "/perfil": "Perfil: datos personales, descargar o borrar la cuenta",
  "/instalar": "Instalar la app en el celular o la computadora",
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type Segment = { text: string; href?: string };

/** Parte una respuesta en texto y enlaces a secciones conocidas de la app (/planes, /suscripcion…). */
export function linkify(text: string): Segment[] {
  const paths = Object.keys(APP_LINKS).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${paths.map((p) => p.replace("/", "\\/")).join("|")})(?![\\w-])`, "g");
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
