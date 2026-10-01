/**
 * Variables de entorno. Las públicas (NEXT_PUBLIC_*) se exponen al navegador; las demás solo existen en el servidor.
 * Nunca exponer la clave secreta / service_role de Supabase al frontend.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

export function isSupabaseConfigured(): boolean {
  return /^https?:\/\//.test(publicEnv.supabaseUrl) && publicEnv.supabaseKey.length > 20;
}
