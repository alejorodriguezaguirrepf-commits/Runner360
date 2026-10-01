import { NextResponse, type NextRequest } from "next/server";
import { processPaymentEvent } from "@/lib/payments/process";
import { getProvider } from "@/lib/payments/registry";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Webhooks de proveedores de pago. Verifica firma → registra evento (idempotente) → actualiza suscripción. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (!provider.isConfigured()) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`webhook:${id}:${ip}`, 300, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const rawBody = await request.text();
  if (rawBody.length > 256_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  let event;
  try {
    event = await provider.parseWebhook({ headers: request.headers, rawBody, url: request.nextUrl });
  } catch (e) {
    console.error(`[webhook:${id}] parse_error`, e instanceof Error ? e.message.slice(0, 100) : "");
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!event) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  const result = await processPaymentEvent(admin, provider.id, event);
  // "failed" responde 500 para que el proveedor reintente; los duplicados responden 200.
  return NextResponse.json({ result }, { status: result === "failed" ? 500 : 200 });
}
