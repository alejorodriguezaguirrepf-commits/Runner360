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
