import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente con privilegios de servicio (omite RLS). SOLO para procesos de backend que no actúan en nombre
 * de un usuario: webhooks de pagos y eliminación de cuentas. Nunca importar desde componentes de cliente.
 */
export function getServiceKey(): string | null {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function createAdminClient() {
  const key = getServiceKey();
  if (!publicEnv.supabaseUrl || !key) return null;
  return createClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
