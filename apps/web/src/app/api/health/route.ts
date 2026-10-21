import { NextResponse } from "next/server";
import { isSupabaseConfigured, missingSupabaseConfig, publicEnv, readEnv } from "@/lib/env";
import { isServiceRoleConfigured } from "@/lib/env.server";
import { readPaymentsConfig } from "@/lib/payments/config";
import { canonicalSiteUrl } from "@/lib/site-url";

/**
 * Diagnóstico de configuración para quien administra el despliegue.
 * Solo informa si cada variable está presente y si el servicio de cuentas responde.
 * Nunca devuelve valores de claves; sí los dominios públicos que usan los enlaces (no son secretos).
 */
export const dynamic = "force-dynamic";

const hostOf = (url: string) => url.replace(/^https?:\/\//, "") || null;

export async function GET() {
  let authService: "ok" | "sin_configurar" | "sin_respuesta" = "sin_configurar";
  if (isSupabaseConfigured()) {
    try {
      const res = await fetch(`${publicEnv.supabaseUrl}/auth/v1/health`, {
        headers: { apikey: publicEnv.supabaseAnonKey },
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      authService = res.ok ? "ok" : "sin_respuesta";
    } catch {
      authService = "sin_respuesta";
    }
  }
  return NextResponse.json(
    {
      ok: authService === "ok",
      variables: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(publicEnv.supabaseUrl),
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicEnv.supabaseAnonKey.length > 20,
        SUPABASE_SERVICE_ROLE_KEY: isServiceRoleConfigured(),
        NEXT_PUBLIC_SITE_URL: Boolean(publicEnv.configuredSiteUrl),
      },
      faltan: missingSupabaseConfig(),
      servicioDeCuentas: authService,
      // Dominio (sin https://) al que vuelven los correos y Mercado Pago: tiene que ser el de producción.
      dominioDeLosEnlaces: hostOf(canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") })),
      dominioDeMercadoPago: hostOf(readPaymentsConfig(process.env).appBaseUrl),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
