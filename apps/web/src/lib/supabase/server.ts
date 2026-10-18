import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { parseViewAs, VIEW_AS_COOKIE, VIEW_AS_HEADER } from "@/lib/view-as";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase no está configurado. Completá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
}

/** Cliente con la sesión del usuario (cookies). Todas las consultas pasan por RLS. */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  // "Ver como usuario": la base solo usa este encabezado para quitarle permisos a un admin.
  const viewAs = parseViewAs(cookieStore.get(VIEW_AS_COOKIE)?.value);
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    ...(viewAs ? { global: { headers: { [VIEW_AS_HEADER]: viewAs } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
}

/** Cliente para la API móvil: usa el JWT del encabezado Authorization (también sujeto a RLS). */
export function createClientWithAccessToken(accessToken: string): SupabaseClient {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  return createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
