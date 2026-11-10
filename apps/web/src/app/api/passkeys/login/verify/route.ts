import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { clientIp, rp, takeChallenge } from "@/lib/passkeys/server";
import { rateLimit } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Paso 2 de ingresar con huella: verifica la firma con la clave pública guardada y, si es válida,
 * inicia la sesión con un enlace de un solo uso generado en el servidor (no se manda ningún correo;
 * es el mismo mecanismo del traspaso de sesión de dominio).
 */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const NOT_FOUND = "No encontramos el ingreso con huella para esta cuenta en este dispositivo. Ingresá con tu contraseña y activalo desde Perfil.";
const FAILED = "No pudimos verificar la huella. Probá de nuevo o ingresá con tu contraseña.";

type PasskeyRow = { id: string; user_id: string; credential_id: string; public_key: string; counter: number; transports: string[] };

export async function POST(request: NextRequest) {
  if (!rateLimit(`pk-verify:${clientIp(request.headers)}`, 10, 60_000).ok) return json({ error: "Demasiados intentos. Esperá un minuto." }, 429);
  const admin = createAdminClient();
  if (!admin) return json({ error: "El ingreso con huella no está disponible por ahora." }, 503);
  const challenge = await takeChallenge(admin, "login");
  if (!challenge) return json({ error: "Se venció el tiempo. Probá de nuevo." }, 400);

  const body = (await request.json().catch(() => null)) as { response?: AuthenticationResponseJSON; next?: string } | null;
  const response = body?.response;
  if (!response?.id || typeof response.id !== "string") return json({ error: FAILED }, 400);

  const { data: key } = await admin
    .from("passkeys")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", response.id)
    .maybeSingle<PasskeyRow>();
  if (!key) return json({ error: NOT_FOUND }, 404);
  // La llave tiene que ser de la misma cuenta que dice el dispositivo.
  const handle = response.response?.userHandle;
  if (handle && isoBase64URL.toUTF8String(handle) !== key.user_id) return json({ error: FAILED }, 400);

  const { rpID, origin } = rp();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: key.credential_id, publicKey: isoBase64URL.toBuffer(key.public_key), counter: Number(key.counter), transports: key.transports },
    });
  } catch (e) {
    logError("passkeys:login-verify", e);
    return json({ error: FAILED }, 400);
  }
  if (!verification.verified) return json({ error: FAILED }, 400);
  await admin
    .from("passkeys")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  // Sesión: la cuenta tiene que existir y no estar suspendida.
  const { data: found, error: userError } = await admin.auth.admin.getUserById(key.user_id);
  const user = found?.user;
  if (userError || !user?.email) return json({ error: NOT_FOUND }, 404);
  if (user.banned_until && new Date(user.banned_until) > new Date()) return json({ error: "Tu cuenta está suspendida." }, 403);
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    logError("passkeys:generateLink", linkError);
    return json({ error: FAILED }, 500);
  }
  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (otpError) {
    logError("passkeys:verifyOtp", otpError);
    return json({ error: FAILED }, 500);
  }
  await supabase.rpc("write_audit_log", { p_action: "passkey.login", p_entity_type: "profile", p_entity_id: key.user_id, p_metadata: {} });
  return json({ ok: true, redirect: safeNextPath(body?.next) ?? "/inicio" });
}
