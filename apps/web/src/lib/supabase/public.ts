import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/** Cliente anónimo sin sesión, para datos públicos (precios, contenidos gratuitos). Sujeto a RLS. */
export function createPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
