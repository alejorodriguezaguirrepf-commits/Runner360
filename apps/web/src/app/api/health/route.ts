import { NextResponse } from "next/server";
import { isSupabaseConfigured, missingSupabaseConfig, publicEnv } from "@/lib/env";
import { isServiceRoleConfigured } from "@/lib/env.server";

/**
 * Diagnóstico de configuración para quien administra el despliegue.
 * Solo informa si cada variable está presente y si el servicio de cuentas responde.
 * Nunca devuelve valores de variables ni claves.
 */
export const dynamic = "force-dynamic";

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
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
