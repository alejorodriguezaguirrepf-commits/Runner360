import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

const PROTECTED = ["/app", "/onboarding", "/admin"];

/**
 * Proxy (ex middleware): refresca la sesión de Supabase y hace una verificación optimista
 * de rutas privadas. La verificación autoritativa de usuario y rol ocurre en los layouts del
 * servidor y, en última instancia, en las políticas RLS de la base de datos.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    if (!isProtected) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "?motivo=configuracion";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims valida la firma del JWT (no confiar en getSession() del lado servidor).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
