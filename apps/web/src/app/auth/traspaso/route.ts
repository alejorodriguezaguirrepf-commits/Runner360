import { NextResponse, type NextRequest } from "next/server";
import { publicEnv, readEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canonicalSiteUrl, safeNextPath } from "@/lib/site-url";

/**
 * Traspaso de sesión del dominio viejo (runner360.vercel.app) al dominio de producción.
 * Las sesiones se guardan por dominio: sin esto, quien ya había ingresado tendría que volver a
 * hacerlo. Se ejecuta en el dominio viejo: verifica la sesión, genera un enlace de ingreso de un solo
 * uso (no manda ningún correo) y lo abre en el dominio nuevo, que lo canjea en /auth/confirm.
 * Si algo falla, simplemente se va al dominio nuevo (donde se puede ingresar como siempre).
 */
export const dynamic = "force-dynamic";

function go(url: string, clearCookies: string[] = []) {
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  // Se cierra la sesión del dominio viejo: las próximas visitas solo redirigen.
  for (const name of clearCookies) res.cookies.set(name, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/inicio";
  const canonical = canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") });
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (!canonical || host === new URL(canonical).host) return go(new URL(next, request.url).toString());

  const target = `${canonical}${next}`;
  const sessionCookies = request.cookies
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-"));
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = createAdminClient();
    if (!user?.email || !admin) return go(target, sessionCookies);
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) {
      if (error) logError("traspaso:generateLink", error);
      return go(target, sessionCookies);
    }
    const confirm = new URL("/auth/confirm", canonical);
    confirm.searchParams.set("token_hash", tokenHash);
    confirm.searchParams.set("type", "magiclink");
    confirm.searchParams.set("next", next);
    return go(confirm.toString(), sessionCookies);
  } catch (e) {
    logError("traspaso", e);
    return go(target, sessionCookies);
  }
}
