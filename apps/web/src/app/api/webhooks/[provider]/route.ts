import { NextResponse, type NextRequest } from "next/server";
import { processWebhook } from "@/lib/payments/process";
import { getProvider } from "@/lib/payments/registry";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Webhooks de proveedores de pago: /api/webhooks/mercadopago y /api/webhooks/stripe. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: "Proveedor desconocido" }, { status: 404 });
  const limit = rateLimit(`webhook:${id}:${clientKey(request.headers)}`, 120, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const rawBody = await request.text();
  if (rawBody.length > 256 * 1024) return NextResponse.json({ error: "Cuerpo demasiado grande" }, { status: 413 });
  const outcome = await processWebhook(provider, { rawBody, headers: request.headers, url: request.nextUrl }, createAdminClient());
  return NextResponse.json(outcome.body, { status: outcome.status });
}
