import "server-only";
import { readPaymentsConfig } from "./payments/config";

/** Secretos de servidor. Este módulo falla en build si se importa desde un componente cliente. */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  get mercadoPagoAccessToken() {
    return readPaymentsConfig(process.env).mpAccessToken;
  },
  get mercadoPagoWebhookSecret() {
    return readPaymentsConfig(process.env).mpWebhookSecret;
  },
  /** Secreto que Vercel Cron manda como "Authorization: Bearer …" a las tareas programadas. */
  get cronSecret() {
    return (process.env.CRON_SECRET ?? "").trim();
  },
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};

export function isServiceRoleConfigured(): boolean {
  return serverEnv.supabaseServiceRoleKey.length > 20;
}
