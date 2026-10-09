import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de los correos (confirmación de cuenta y recuperación de contraseña).
 * Soporta el flujo con token_hash (plantillas personalizadas) y el flujo PKCE con `code`
 * (plantillas por defecto).
 *
 * En el flujo PKCE, cuando llega `code` el correo YA fue verificado. Si el enlace se abre en otro
 * navegador o dispositivo no se puede crear la sesión acá, pero la cuenta igual queda confirmada:
 * en ese caso se invita a ingresar en lugar de mostrar un error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const rawNext = searchParams.get("next") ?? "/inicio";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/inicio";
  const isRecovery = next === "/restablecer" || searchParams.get("type") === "recovery";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  // Errores que informa el servicio en la URL (p. ej. enlace vencido o ya usado).
  const errorCode = searchParams.get("error_code") ?? searchParams.get("error");
  if (errorCode) return to(errorCode === "otp_expired" ? "/ingresar?error=vencido" : "/ingresar?error=enlace");

  try {
    const supabase = await createClient();
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return to(next);
      logError("confirm:verifyOtp", error);
      return to(error.code === "otp_expired" ? "/ingresar?error=vencido" : "/ingresar?error=enlace");
    }
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return to(next);
      logError("confirm:exchange", error);
      return to(isRecovery ? "/ingresar?error=recuperacion" : "/ingresar?confirmado=1");
    }
  } catch (e) {
    logError("confirm", e);
  }
  return to("/ingresar?error=enlace");
}
