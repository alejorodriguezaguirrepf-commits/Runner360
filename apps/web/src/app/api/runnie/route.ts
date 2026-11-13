import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { rateLimit } from "@/lib/rate-limit";
import { answer, sanitizeHistory } from "@/lib/runnie/answer";
import { runnieContext } from "@/lib/runnie/context";

/**
 * Runnie: responde la pregunta de la persona dentro de la app, sin servicios externos (gratis para
 * todas las personas con cuenta y sin costo para RUNNER 360). Respuesta en líneas JSON (NDJSON):
 * {"t":"delta","text"} y al final {"t":"done"}. El chat también entiende {"t":"error","message"}.
 */
export const dynamic = "force-dynamic";

const MSG = {
  invalid: "No entendí la pregunta. Escribila de nuevo, por favor.",
  busy: "Estás escribiendo muy rápido. Esperá unos segundos y probá de nuevo.",
  failed: "Runnie no pudo responder esta vez. Probá de nuevo en un momento.",
};

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !session.profile.onboarding_completed_at) return json({ error: "No autorizado" }, 401);
  if (!rateLimit(`runnie:${session.user.id}`, 20, 60_000).ok) return json({ error: MSG.busy }, 429);

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const messages = sanitizeHistory(body?.messages);
  if (!messages) return json({ error: MSG.invalid }, 400);

  try {
    const context = await runnieContext(session);
    const text = answer(messages.at(-1)!.content, context);
    const lines = [JSON.stringify({ t: "delta", text }), JSON.stringify({ t: "done" })].join("\n");
    return new NextResponse(`${lines}\n`, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    logError("runnie:reply", e);
    return json({ error: MSG.failed }, 500);
  }
}

/** Runnie está disponible para toda persona con sesión. */
export async function GET() {
  const session = await getSession();
  if (!session) return json({ error: "No autorizado" }, 401);
  return json({ enabled: true }, 200);
}
