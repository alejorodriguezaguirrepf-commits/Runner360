import "server-only";
import { readEnv } from "@/lib/env";
import { logError } from "@/lib/log";

/**
 * Mails al admin con Resend (API REST, sin SDK). Sin RESEND_API_KEY no se envía nada.
 * Sin dominio propio verificado, Resend solo entrega a la dirección dueña de la cuenta: por eso
 * por ahora los mails son solo para el admin (los usuarios reciben el cartel en la app y push).
 */
const OWNER_EMAIL = "alejorodriguezaguirrepf@gmail.com";

export function isEmailConfigured(): boolean {
  return readEnv("RESEND_API_KEY").length > 10;
}

export function adminEmailAddress(): string {
  return readEnv("ADMIN_NOTIFICATIONS_EMAIL") || OWNER_EMAIL;
}

export async function sendAdminEmail(msg: { subject: string; text: string; link?: string }, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const key = readEnv("RESEND_API_KEY");
  if (key.length <= 10) return false;
  const text = msg.link ? `${msg.text}\n\n${msg.link}` : msg.text;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: readEnv("RESEND_FROM") || "Runner 360 <onboarding@resend.dev>",
        to: [adminEmailAddress()],
        subject: msg.subject,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) logError("email:admin", `Resend ${res.status}`);
    return res.ok;
  } catch (e) {
    logError("email:admin", e);
    return false;
  }
}

/**
 * Correos a usuarios: necesitan un remitente con dominio propio verificado en Resend (RESEND_FROM, p. ej.
 * "RUNNER 360 <hola@runner360.ar>"). Con el remitente de prueba de Resend no se envían.
 */
export function isUserEmailConfigured(): boolean {
  const from = readEnv("RESEND_FROM");
  return isEmailConfigured() && from.includes("@") && !from.includes("resend.dev");
}

export type UserEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Baja con un toque desde el programa de correo (acepta POST, RFC 8058). */
  oneClickUrl: string;
};

/**
 * Envía varios correos en una sola llamada (API de lotes de Resend, hasta 100 por llamada: respeta el
 * límite de pedidos por segundo). Devuelve si el lote se aceptó.
 */
export async function sendUserEmailBatch(msgs: UserEmail[], fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!isUserEmailConfigured() || msgs.length === 0) return false;
  try {
    const res = await fetchImpl("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${readEnv("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        msgs.map((m) => ({
          from: readEnv("RESEND_FROM"),
          to: [m.to],
          subject: m.subject,
          text: m.text,
          html: m.html,
          // Baja con un toque desde el programa de correo (RFC 8058).
          headers: { "List-Unsubscribe": `<${m.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        })),
      ),
      signal: AbortSignal.timeout(20_000),
    });
    // Sin direcciones en los registros: son datos personales.
    if (!res.ok) logError("email:users", `Resend ${res.status}`);
    return res.ok;
  } catch (e) {
    logError("email:users", e instanceof Error ? e.name : "error");
    return false;
  }
}
