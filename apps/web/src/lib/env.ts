/**
 * Variables de entorno públicas (seguras para el navegador).
 * Las claves secretas viven en `env.server.ts` y nunca se importan desde componentes cliente.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase llama "publishable key" a la antigua "anon key"; aceptamos ambas.
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
};

export function isSupabaseConfigured(): boolean {
  return publicEnv.supabaseUrl.startsWith("http") && publicEnv.supabaseAnonKey.length > 20;
}
