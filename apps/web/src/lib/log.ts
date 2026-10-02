import "server-only";

/**
 * Registro de errores sin datos personales: se eliminan correos, tokens y UUID de usuario.
 * Punto único para conectar luego un servicio de monitoreo (Sentry u otro).
 */
const REDACTIONS: [RegExp, string][] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[uuid]"],
];

export function redact(text: string): string {
  return REDACTIONS.reduce((acc, [re, rep]) => acc.replace(re, rep), text);
}

export function logError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : typeof error === "object" ? JSON.stringify(error) : String(error);
  console.error(`[runner360] ${context}: ${redact(message)}`);
}
