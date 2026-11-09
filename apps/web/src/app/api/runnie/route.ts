import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isRunnieConfigured, serverEnv } from "@/lib/env.server";
import { logError } from "@/lib/log";
import { rateLimit } from "@/lib/rate-limit";
import { runnieContext } from "@/lib/runnie/context";
import { contextBlock, RUNNIE_SYSTEM, sanitizeHistory } from "@/lib/runnie/prompt";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runnie: responde una pregunta de la persona con la API de Claude. Respuesta en líneas JSON
 * (NDJSON) a medida que se escribe: {"t":"delta","text"} …, y al final {"t":"done","remaining"} o
 * {"t":"error","message"}. El cupo diario lo controla la base (runnie_take_message); si Runnie no
 * llega a responder, el mensaje se devuelve al cupo.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";

const MSG = {
  unavailable: "Runnie no está disponible por ahora. Probá más tarde.",
  limit: "Llegaste al tope de mensajes de hoy. Mañana podés seguir preguntando.",
  invalid: "No entendí la pregunta. Escribila de nuevo, por favor.",
  busy: "Estás escribiendo muy rápido. Esperá unos segundos y probá de nuevo.",
  failed: "Runnie no pudo responder esta vez. Probá de nuevo en un momento: no se descontó el mensaje.",
  refused: "De eso no puedo ayudarte. Si querés, preguntame sobre tu entrenamiento o sobre la app.",
};

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function giveBack(userId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("runnie_give_back", { p_user: userId });
  if (error) logError("runnie:give-back", error);
}

export async function POST(request: NextRequest) {
  if (!isRunnieConfigured()) return json({ error: MSG.unavailable }, 503);
  const session = await getSession();
  if (!session || !session.profile.onboarding_completed_at) return json({ error: "No autorizado" }, 401);
  const userId = session.user.id;
  if (!rateLimit(`runnie:${userId}`, 8, 60_000).ok) return json({ error: MSG.busy }, 429);

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const messages = sanitizeHistory(body?.messages);
  if (!messages) return json({ error: MSG.invalid }, 400);

  const { data: remaining, error: quotaError } = await session.supabase.rpc("runnie_take_message");
  if (quotaError || typeof remaining !== "number") {
    logError("runnie:quota", quotaError);
    return json({ error: MSG.unavailable }, 503);
  }
  if (remaining < 0) return json({ error: MSG.limit, remaining: 0 }, 429);

  const context = await runnieContext(session, remaining);
  const client = new Anthropic({ apiKey: serverEnv.anthropicApiKey, maxRetries: 1 });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let wrote = false;
      try {
        const reply = client.beta.messages.stream(
          {
            model: MODEL,
            max_tokens: 4000,
            // Charla breve: esfuerzo bajo alcanza y abarata cada respuesta.
            output_config: { effort: "low" },
            // Si el modelo declina por política, la API reintenta con otro modelo en la misma llamada.
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: [
              // Parte fija (instrucciones y conocimiento): se cachea entre conversaciones.
              { type: "text", text: RUNNIE_SYSTEM, cache_control: { type: "ephemeral" } },
              { type: "text", text: contextBlock(context) },
            ],
            messages,
          },
          { signal: request.signal },
        );
        for await (const event of reply) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            wrote = true;
            send({ t: "delta", text: event.delta.text });
          }
        }
        const final = await reply.finalMessage();
        console.info(
          JSON.stringify({
            event: "runnie:usage",
            model: final.model,
            stop: final.stop_reason,
            input: final.usage.input_tokens,
            cacheRead: final.usage.cache_read_input_tokens ?? 0,
            cacheWrite: final.usage.cache_creation_input_tokens ?? 0,
            output: final.usage.output_tokens,
          }),
        );
        if (final.stop_reason === "refusal") {
          if (!wrote) await giveBack(userId);
          send({ t: "error", message: MSG.refused, keep: wrote });
        } else if (!wrote) {
          await giveBack(userId);
          send({ t: "error", message: MSG.failed });
        } else {
          if (final.stop_reason === "max_tokens") send({ t: "delta", text: "…" });
          send({ t: "done", remaining });
        }
      } catch (e) {
        if (!request.signal.aborted) logError("runnie:reply", e);
        if (!wrote) await giveBack(userId);
        try {
          send({ t: "error", message: MSG.failed, keep: wrote });
        } catch {
          // La persona cerró el chat: no hay a quién avisar.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Ya cerrado.
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Cuántos mensajes le quedan hoy (para mostrar en el chat al abrirlo). */
export async function GET() {
  if (!isRunnieConfigured()) return json({ enabled: false }, 200);
  const session = await getSession();
  if (!session) return json({ error: "No autorizado" }, 401);
  const [{ data: remaining }, { data: limit }] = await Promise.all([session.supabase.rpc("runnie_remaining"), session.supabase.rpc("runnie_daily_limit")]);
  return json({ enabled: true, remaining: typeof remaining === "number" ? remaining : null, limit: typeof limit === "number" ? limit : null }, 200);
}
