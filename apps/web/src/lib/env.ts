/**
 * Configuración pública (no secreta) de la app.
 *
 * Las variables se leen en TIEMPO DE EJECUCIÓN (acceso dinámico a process.env), no se fijan al
 * compilar: así una página nunca queda "congelada" sin configuración porque las variables se
 * cargaron después de un build. Solo se usa en código de servidor (Server Components, Server
 * Actions, Route Handlers y proxy); ningún componente de navegador importa este módulo.
 *
 * Las claves secretas viven en `env.server.ts`.
 */

/** Lee una variable en runtime y la normaliza (espacios y comillas pegadas por error). */
export function readEnv(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
}

function firstEnv(names: readonly string[]): string {
  for (const n of names) {
    const v = readEnv(n);
    if (v) return v;
  }
  return "";
}

/**
 * Normaliza la URL del proyecto: acepta también la URL copiada con rutas extra
 * (p. ej. https://xxxx.supabase.co/rest/v1/) y la reduce al origen.
 */
export function normalizeBaseUrl(value: string): string {
  const m = /^(https?:\/\/[^/\s?#]+)/i.exec(value.trim());
  return m ? m[1]!.toLowerCase() : "";
}

/** Nombres aceptados. El primero de cada lista es el recomendado (README y .env.example). */
export const ENV_NAMES = {
  supabaseUrl: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"],
  // "publishable key" es el nombre actual de la antigua "anon key"; se aceptan ambas.
  supabaseAnonKey: [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ],
  siteUrl: ["NEXT_PUBLIC_SITE_URL"],
  supportEmail: ["NEXT_PUBLIC_SUPPORT_EMAIL"],
} as const;

export const publicEnv = {
  get supabaseUrl(): string {
    return normalizeBaseUrl(firstEnv(ENV_NAMES.supabaseUrl));
  },
  get supabaseAnonKey(): string {
    return firstEnv(ENV_NAMES.supabaseAnonKey);
  },
  /** URL pública configurada (puede estar vacía; para enlaces de correo usar `getSiteUrl()`). */
  get configuredSiteUrl(): string {
    return normalizeBaseUrl(firstEnv(ENV_NAMES.siteUrl));
  },
  /** URL base para metadatos. Prefiere la configurada; si no, la de producción de Vercel. */
  get siteUrl(): string {
    const vercel = readEnv("VERCEL_PROJECT_PRODUCTION_URL");
    return this.configuredSiteUrl || (vercel ? `https://${vercel}` : "http://localhost:3000");
  },
  get supportEmail(): string {
    return firstEnv(ENV_NAMES.supportEmail);
  },
};

/** Qué falta para que funcionen el registro y el ingreso (nombres de variables, sin valores). */
export function missingSupabaseConfig(): string[] {
  const missing: string[] = [];
  if (!publicEnv.supabaseUrl) missing.push(ENV_NAMES.supabaseUrl[0]);
  if (publicEnv.supabaseAnonKey.length <= 20) missing.push(ENV_NAMES.supabaseAnonKey[0]);
  return missing;
}

export function isSupabaseConfigured(): boolean {
  return missingSupabaseConfig().length === 0;
}

/** Mensaje para el usuario final cuando el servicio de cuentas no está disponible. */
export const AUTH_UNAVAILABLE_MESSAGE =
  "El registro y el ingreso no están disponibles en este momento. Probá de nuevo en unos minutos.";
