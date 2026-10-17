/**
 * Configuración de cobros (solo servidor). Función pura sobre un objeto de entorno: se valida al
 * arrancar (instrumentation.ts) y en las pruebas.
 *
 * Nombres recomendados: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_ENV (test | prod), APP_BASE_URL,
 * FX_SOURCE, FX_RATE_TYPE. Se aceptan los nombres anteriores (MERCADOPAGO_*, NEXT_PUBLIC_SITE_URL)
 * para no cortar una instalación ya configurada.
 */
export type MpEnv = "test" | "prod";
export type FxSource = "dolarapi" | "bcra";

export type PaymentsConfig = {
  mpAccessToken: string;
  mpWebhookSecret: string;
  /** null = MP_ENV sin definir (modo anterior: sin validación estricta). */
  mpEnv: MpEnv | null;
  appBaseUrl: string;
  fxSource: FxSource;
  fxRateType: string;
};

type Env = Record<string, string | undefined>;

function read(env: Env, ...names: string[]): string {
  for (const n of names) {
    const v = env[n]?.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
    if (v) return v;
  }
  return "";
}

export const FX_DEFAULTS = { source: "dolarapi" as FxSource, rateType: "oficial" };

export function readPaymentsConfig(env: Env): PaymentsConfig {
  const mpEnv = read(env, "MP_ENV").toLowerCase();
  const fxSource = read(env, "FX_SOURCE").toLowerCase();
  return {
    mpAccessToken: read(env, "MP_ACCESS_TOKEN", "MERCADOPAGO_ACCESS_TOKEN"),
    mpWebhookSecret: read(env, "MP_WEBHOOK_SECRET", "MERCADOPAGO_WEBHOOK_SECRET"),
    mpEnv: mpEnv === "test" || mpEnv === "prod" ? mpEnv : null,
    appBaseUrl: read(env, "APP_BASE_URL", "NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
    fxSource: fxSource === "bcra" ? "bcra" : FX_DEFAULTS.source,
    fxRateType: read(env, "FX_RATE_TYPE").toLowerCase() || FX_DEFAULTS.rateType,
  };
}

/**
 * Problemas que impiden arrancar (errores) y avisos. Con MP_ENV definido la validación es estricta:
 * faltantes, entorno inválido o credenciales de prueba en producción detienen la app.
 * Las credenciales de prueba de Mercado Pago empiezan con "TEST-"; las de producción, con "APP_USR-".
 * (Las cuentas de prueba de suscripciones también usan "APP_USR-": eso se verifica contra la API con
 * `pnpm payments:check`.)
 */
export function paymentsConfigProblems(env: Env): { errors: string[]; warnings: string[] } {
  const c = readPaymentsConfig(env);
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawEnv = read(env, "MP_ENV");
  const rawFx = read(env, "FX_SOURCE").toLowerCase();

  if (rawFx && rawFx !== "dolarapi" && rawFx !== "bcra") errors.push(`FX_SOURCE inválido ("${rawFx}"): usá dolarapi o bcra.`);
  if (rawEnv && !c.mpEnv) errors.push(`MP_ENV inválido ("${rawEnv}"): usá test o prod.`);

  if (c.mpEnv) {
    if (!c.mpAccessToken) errors.push("Falta MP_ACCESS_TOKEN (Mercado Pago).");
    if (!c.mpWebhookSecret) errors.push("Falta MP_WEBHOOK_SECRET (clave secreta de los webhooks de Mercado Pago).");
    if (!c.appBaseUrl) errors.push("Falta APP_BASE_URL (dominio público de la app, por ejemplo https://runner360.vercel.app).");
    if (c.mpAccessToken && !/^(TEST|APP_USR)-/.test(c.mpAccessToken)) errors.push("MP_ACCESS_TOKEN no parece un Access Token de Mercado Pago.");
    if (c.mpEnv === "prod" && c.mpAccessToken.startsWith("TEST-")) errors.push("MP_ENV=prod con credenciales de prueba (TEST-).");
    if (c.mpEnv === "prod" && c.appBaseUrl && !c.appBaseUrl.startsWith("https://")) errors.push("MP_ENV=prod requiere APP_BASE_URL con https.");
  } else if (c.mpAccessToken) {
    warnings.push("Mercado Pago configurado sin MP_ENV: definí MP_ENV=test o MP_ENV=prod para activar la validación.");
  }
  return { errors, warnings };
}
