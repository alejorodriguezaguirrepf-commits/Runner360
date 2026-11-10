import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse, type NextRequest } from "next/server";
import { logError } from "@/lib/log";
import { clientIp, rp, saveChallenge } from "@/lib/passkeys/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Paso 1 de ingresar con huella (sin sesión): un desafío para que el dispositivo lo firme. */
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!rateLimit(`pk-login:${clientIp(request.headers)}`, 20, 60_000).ok) return json({ error: "Demasiados intentos. Esperá un minuto." }, 429);
  const admin = createAdminClient();
  if (!admin) return json({ error: "El ingreso con huella no está disponible por ahora." }, 503);
  // Sin lista de llaves: el dispositivo ofrece las de RUNNER 360 que tenga guardadas.
  const options = await generateAuthenticationOptions({ rpID: rp().rpID, userVerification: "required" });
  if (!(await saveChallenge(admin, "login", options.challenge, null))) {
    logError("passkeys:login-options", "no se pudo guardar el desafío");
    return json({ error: "No pudimos empezar. Probá de nuevo." }, 500);
  }
  return json({ options });
}
