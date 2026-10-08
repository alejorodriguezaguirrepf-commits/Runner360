import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { isServiceRoleConfigured, serverEnv } from "@/lib/env.server";

/**
 * Cliente con service_role: OMITE RLS. Usar solo en el servidor para tareas que no pueden
 * hacerse con la sesión del usuario (webhooks de pago, eliminación de cuenta).
 * Devuelve null si no está configurado, para que el llamador informe "pendiente de configuración".
 */
export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) return null;
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
