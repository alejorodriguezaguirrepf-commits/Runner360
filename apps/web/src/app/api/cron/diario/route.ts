import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { serverEnv } from "@/lib/env.server";
import { refreshRate } from "@/lib/fx/rates";

/**
 * Tarea diaria (Vercel Cron, ver vercel.json): actualiza la cotización del dólar.
 * Vercel manda "Authorization: Bearer $CRON_SECRET"; sin ese secreto configurado no corre.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!serverEnv.cronSecret) return NextResponse.json({ error: "Tarea programada pendiente de configuración" }, { status: 503 });
  if (!isCronAuthorized(request.headers.get("authorization"), serverEnv.cronSecret)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const quote = await refreshRate();
  return NextResponse.json({ fx: quote ? { ok: true, source: quote.source, rateType: quote.rateType, quotedAt: quote.quotedAt } : { ok: false } });
}
