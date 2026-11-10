import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { MAX_PASSKEYS, userHandle } from "@/lib/passkeys/config";
import { rp, saveChallenge } from "@/lib/passkeys/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Paso 1 de activar la huella en este dispositivo (con sesión iniciada): opciones para el navegador. */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST() {
  const session = await getSession();
  if (!session) return json({ error: "Ingresá a tu cuenta para activar el ingreso con huella." }, 401);
  if (!rateLimit(`pk-reg:${session.user.id}`, 10, 60_000).ok) return json({ error: "Demasiados intentos. Esperá un minuto." }, 429);
  const admin = createAdminClient();
  if (!admin) return json({ error: "El ingreso con huella no está disponible por ahora." }, 503);

  const { data: existing } = await session.supabase.from("passkeys").select("credential_id, transports");
  const keys = (existing ?? []) as { credential_id: string; transports: string[] }[];
  if (keys.length >= MAX_PASSKEYS) return json({ error: `Llegaste al máximo de ${MAX_PASSKEYS} dispositivos. Quitá uno que no uses.` }, 409);

  const { rpID } = rp();
  const options = await generateRegistrationOptions({
    rpName: "RUNNER 360",
    rpID,
    userName: session.user.email ?? session.user.id,
    userDisplayName: session.profile.display_name ?? session.user.email ?? "",
    userID: userHandle(session.user.id),
    attestationType: "none",
    // No volver a registrar una llave que ya está en este dispositivo.
    excludeCredentials: keys.map((k) => ({ id: k.credential_id, transports: k.transports })),
    // Llave guardada en el dispositivo (huella, Face ID o bloqueo de pantalla) y siempre verificando a la persona.
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
  });
  if (!(await saveChallenge(admin, "register", options.challenge, session.user.id))) {
    logError("passkeys:register-options", "no se pudo guardar el desafío");
    return json({ error: "No pudimos empezar. Probá de nuevo." }, 500);
  }
  return json({ options });
}
