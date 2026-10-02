import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (ex middleware): refresca la sesión de Supabase y hace una primera barrera de rutas.
 * La protección real se repite en cada layout/acción del servidor y en RLS.
 */

const PRIVATE_PREFIXES = ["/inicio", "/plan", "/registrar", "/progreso", "/perfil", "/hidratacion", "/competencias", "/suscripcion", "/entrenamientos", "/onboarding", "/admin"];
const AUTH_PAGES = ["/ingresar", "/registro"];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!url || !key) {
    // Sin Supabase configurado, las rutas privadas muestran la pantalla de configuración pendiente.
    if (isPrivate) return NextResponse.redirect(new URL("/ingresar?config=pendiente", request.url));
    return NextResponse.next();
  }

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
