"use server";

import type { SubscriptionRow } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { createCheckoutUrl, siteBase } from "@/lib/payments/checkout";
import { getProvider } from "@/lib/payments/registry";
import { createAdminClient } from "@/lib/supabase/admin";

const checkoutSchema = z.object({ productId: z.uuid(), provider: z.enum(["mercadopago", "stripe"]) });

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireOnboardedSession();
  const parsed = checkoutSchema.safeParse({ productId: formData.get("productId"), provider: formData.get("provider") });
  if (!parsed.success) return { ok: false, message: "Opción inválida." };
  const base = siteBase();
  const result = await createCheckoutUrl(supabase, {
    userId: user.id,
    email: user.email ?? "",
    productId: parsed.data.productId,
    provider: parsed.data.provider,
    successUrl: `${base}/suscripcion?estado=procesando`,
    cancelUrl: `${base}/suscripcion`,
  });
  if ("error" in result) return { ok: false, message: result.error };
  redirect(result.url);
}

export async function cancelSubscriptionAction(_prev: ActionState): Promise<ActionState> {
  const { supabase, user } = await requireOnboardedSession();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow & { provider_subscription_id: string | null }>();
  if (!sub) return { ok: false, message: "No tenés una suscripción activa." };
  if (sub.provider === "manual") return { ok: false, message: "Tu acceso Premium fue otorgado por el equipo. Escribinos para modificarlo." };
  if (sub.provider === "apple" || sub.provider === "google") return { ok: false, message: "Las suscripciones de la app se cancelan desde la tienda de tu teléfono." };
  const provider = getProvider(sub.provider);
  const admin = createAdminClient();
  if (!provider?.isConfigured() || !admin || !sub.provider_subscription_id) return { ok: false, message: "La cancelación automática está pendiente de configuración." };
  try {
    await provider.cancelAtPeriodEnd(sub.provider_subscription_id);
    await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", sub.id);
  } catch (e) {
    logError("cancelSubscription", e);
    return { ok: false, message: "No pudimos cancelar. Probá más tarde." };
  }
  revalidatePath("/perfil");
  revalidatePath("/suscripcion");
  return { ok: true, message: "Cancelaste el débito automático: no se te va a cobrar más. Mantenés el acceso hasta el fin del período pago y después se bloquea el plan completo; tus entrenamientos guardados siguen en Historial." };
}
