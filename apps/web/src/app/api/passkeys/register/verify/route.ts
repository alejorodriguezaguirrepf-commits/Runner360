import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { deviceName, MAX_PASSKEYS } from "@/lib/passkeys/config";
import { rp, takeChallenge } from "@/lib/passkeys/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Paso 2 de activar la huella: verifica la llave nueva y la guarda (solo su clave pública). */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return json({ error: "Ingresá a tu cuenta para activar el ingreso con huella." }, 401);
  const admin = createAdminClient();
  if (!admin) return json({ error: "El ingreso con huella no está disponible por ahora." }, 503);
  const challenge = await takeChallenge(admin, "register");
  if (!challenge || challenge.user_id !== session.user.id) return json({ error: "Se venció el tiempo. Probá de nuevo." }, 400);

  const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  if (!body?.response) return json({ error: "No recibimos la huella. Probá de nuevo." }, 400);
  const { rpID, origin } = rp();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    logError("passkeys:register-verify", e);
    return json({ error: "No pudimos verificar la huella. Probá de nuevo." }, 400);
  }
  if (!verification.verified) return json({ error: "No pudimos verificar la huella. Probá de nuevo." }, 400);

  const { count } = await admin.from("passkeys").select("id", { count: "exact", head: true }).eq("user_id", session.user.id);
  if ((count ?? 0) >= MAX_PASSKEYS) return json({ error: `Llegaste al máximo de ${MAX_PASSKEYS} dispositivos. Quitá uno que no uses.` }, 409);

  const { credential, credentialBackedUp } = verification.registrationInfo;
  const { error } = await admin.from("passkeys").insert({
    user_id: session.user.id,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    backed_up: credentialBackedUp,
    device_name: deviceName(request.headers.get("user-agent") ?? ""),
  });
  if (error) {
    logError("passkeys:register-insert", error);
    return json({ error: error.code === "23505" ? "Este dispositivo ya tiene el ingreso con huella activado." : "No pudimos guardar la huella. Probá de nuevo." }, 400);
  }
  await session.supabase.rpc("write_audit_log", { p_action: "passkey.registered", p_entity_type: "profile", p_entity_id: session.user.id, p_metadata: {} });
  return json({ ok: true });
}
