import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Proxy (ex middleware): refresca la sesión de Supabase y hace una primera barrera de rutas.
 * La protección real se repite en cada layout/acción del servidor y en RLS.
 */

const PRIVATE_PREFIXES = ["/inicio", "/plan", "/registrar", "/progreso", "/perfil", "/hidratacion", "/competencias", "/suscripcion", "/entrenamientos", "/onboarding", "/admin"];
const AUTH_PAGES = ["/ingresar", "/registro"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isSupabaseConfigured()) {
    // Sin servicio de cuentas configurado, las rutas privadas llevan a la pantalla de ingreso,
    // que muestra un aviso claro para el usuario.
    if (isPrivate) return NextResponse.redirect(new URL("/ingresar", request.url));
    return NextResponse.next();
  }
  const url = publicEnv.supabaseUrl;
  const key = publicEnv.supabaseAnonKey;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() valida el token contra Supabase Auth (no confía solo en la cookie).
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    // Si el servicio de cuentas no responde, no se bloquea la navegación: cada página vuelve a
    // verificar la sesión y muestra un mensaje claro.
    return response;
  }

  if (!user && isPrivate) {
    const login = new URL("/ingresar", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  if (user && AUTH_PAGES.includes(path)) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
