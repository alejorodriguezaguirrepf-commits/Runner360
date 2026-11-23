import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Planes que se pueden pagar desde el correo ("?plan=mensual" o "?plan=anual"). */
export const EMAIL_PLANS = { mensual: "premium_monthly", anual: "premium_yearly" } as const;
export type EmailPlan = keyof typeof EMAIL_PLANS;
export const isEmailPlan = (p: unknown): p is EmailPlan => p === "mensual" || p === "anual";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Persona a la que pertenece un código de pago de los correos (null si no existe). */
export async function payUserFromToken(admin: SupabaseClient, token: string): Promise<{ userId: string; email: string } | null> {
  if (!UUID.test(token)) return null;
  const { data } = await admin.from("email_preferences").select("user_id").eq("pay_token", token).maybeSingle<{ user_id: string }>();
  if (!data) return null;
  const { data: u } = await admin.auth.admin.getUserById(data.user_id);
  return u.user?.email ? { userId: data.user_id, email: u.user.email } : null;
}
