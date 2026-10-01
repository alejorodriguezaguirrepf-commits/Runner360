import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Cliente para la app móvil: usa el access token (JWT) enviado en Authorization: Bearer.
 * Supabase valida el token y aplica RLS con la identidad del usuario.
 */
export async function createClientFromBearer(request: Request) {
  if (!isSupabaseConfigured()) return null;
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
  if (!token) return null;
  const client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, user: data.user };
}
