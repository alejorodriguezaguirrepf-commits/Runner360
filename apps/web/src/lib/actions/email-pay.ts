"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { createCheckoutUrl, siteBase } from "@/lib/payments/checkout";
import { EMAIL_PLANS, isEmailPlan, payUserFromToken } from "@/lib/payments/email-pay";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

/** Empieza el pago desde el link del correo (sin sesión): el código identifica a la persona. */
export async function payFromEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const plan = formData.get("plan");
  if (!isEmailPlan(plan)) return { ok: false, message: "El link no es válido." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sin-ip";
  if (!rateLimit(`email-pay:${ip}`, 10, 60_000).ok || !rateLimit(`email-pay-token:${token}`, 5, 60_000).ok) {
    return { ok: false, message: "Probá de nuevo en un minuto." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Los pagos no están disponibles en este momento. Probá más tarde." };
  const who = await payUserFromToken(admin, token);
  if (!who) return { ok: false, message: "El link no es válido. Entrá a la app para suscribirte." };
  const { data: product } = await admin.from("subscription_products").select("id").eq("code", EMAIL_PLANS[plan]).eq("active", true).maybeSingle<{ id: string }>();
  if (!product) return { ok: false, message: "Ese plan no está disponible en este momento." };
  const base = siteBase();
  const result = await createCheckoutUrl(admin, {
    userId: who.userId,
    email: who.email,
    productId: product.id,
    provider: "mercadopago",
    successUrl: `${base}/pagar/${token}/listo`,
    cancelUrl: `${base}/pagar/${token}/listo?cancelado=1`,
  });
  if ("error" in result) return { ok: false, message: result.error };
  redirect(result.url);
}
