import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, readEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import type { NormalizedPayment } from "@/lib/payments/types";
import { canonicalSiteUrl } from "@/lib/site-url";
import { sendAdminEmail } from "./email";
import { adminTexts, UPDATE_PAYMENT_URL, userTexts, type PaymentFacts } from "./payment-texts";
import { sendPush } from "./push";

/**
 * Notificaciones de pagos: al admin (panel, mail y push según los canales activos) y al usuario
 * (cartel en la app y push). Cada aviso tiene una clave única: si Mercado Pago manda el mismo
 * evento dos veces, se notifica una sola vez. Un error acá nunca hace fallar el webhook.
 */
type Kind = "payment_approved" | "payment_failed" | "payment_recovered" | "access_ended";
type SubRef = { id: string; user_id: string };

const site = () => canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") }) || "https://runner360.vercel.app";

/** Inserta si la clave no existe. Devuelve true si es nueva (hay que avisar). */
async function insertOnce(admin: SupabaseClient, table: "admin_notifications" | "user_notices", row: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await admin.from(table).upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function userFacts(admin: SupabaseClient, sub: SubRef): Promise<{ name: string; email: string; plan: string }> {
  const [{ data: profile }, { data: auth }, { data: s }] = await Promise.all([
    admin.from("profiles").select("display_name").eq("id", sub.user_id).maybeSingle<{ display_name: string | null }>(),
    admin.auth.admin.getUserById(sub.user_id),
    admin.from("subscriptions").select("subscription_products(name)").eq("id", sub.id).maybeSingle<{ subscription_products: { name: string } | null }>(),
  ]);
  return { name: profile?.display_name || "Sin nombre", email: auth?.user?.email ?? "sin correo", plan: s?.subscription_products?.name ?? "Premium" };
}

async function notifyAdmin(admin: SupabaseClient, kind: Kind, sub: SubRef, text: { title: string; body: string }, dedupeKey: string, data: Record<string, unknown>): Promise<void> {
  const isNew = await insertOnce(admin, "admin_notifications", { kind, user_id: sub.user_id, subscription_id: sub.id, title: text.title, body: text.body, dedupe_key: dedupeKey, data });
  if (!isNew) return;
  const { data: settings } = await admin.from("notification_settings").select("admin_email_enabled, admin_push_enabled").maybeSingle<{ admin_email_enabled: boolean; admin_push_enabled: boolean }>();
  const link = `${site()}/admin/notificaciones`;
  if (settings?.admin_email_enabled ?? true) await sendAdminEmail({ subject: `RUNNER 360 · ${text.title}`, text: text.body, link });
  if (settings?.admin_push_enabled ?? true) {
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    await sendPush(admin, ((admins ?? []) as { id: string }[]).map((a) => a.id), { title: text.title, body: text.body, url: "/admin/notificaciones", tag: dedupeKey });
  }
}

async function notifyUser(admin: SupabaseClient, sub: SubRef, kind: "payment_failed" | "payment_recovered" | "access_ended", message: string, dedupeKey: string): Promise<void> {
  const actionUrl = kind === "payment_recovered" ? null : UPDATE_PAYMENT_URL;
  const isNew = await insertOnce(admin, "user_notices", { user_id: sub.user_id, subscription_id: sub.id, kind, message, action_url: actionUrl, dedupe_key: dedupeKey });
  if (!isNew) return;
  const title = kind === "payment_recovered" ? "Pago acreditado" : kind === "access_ended" ? "Acceso Premium pausado" : "No pudimos cobrar tu suscripción";
  await sendPush(admin, [sub.user_id], { title, body: message, url: kind === "payment_recovered" ? "/inicio" : "/suscripcion", tag: dedupeKey });
}

async function resolveFailures(admin: SupabaseClient, sub: SubRef): Promise<void> {
  await admin.from("user_notices").update({ resolved_at: new Date().toISOString() }).eq("user_id", sub.user_id).eq("kind", "payment_failed").is("resolved_at", null);
}

/** ¿Es el primer pago aprobado de la persona? (si no, es una renovación) */
async function isFirstPayment(admin: SupabaseClient, sub: SubRef, payment: NormalizedPayment): Promise<boolean> {
  const { count } = await admin
    .from("subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", sub.user_id)
    .eq("status", "approved")
    .neq("provider_payment_id", payment.providerPaymentId)
    .lte("paid_at", payment.paidAt);
  return (count ?? 0) === 0;
}

/**
 * Después de registrar un débito o pago en el webhook.
 * recovered: el pago aprobado regulariza un débito rechazado (la suscripción estaba en gracia).
 */
export async function notifyPayment(admin: SupabaseClient, provider: string, sub: SubRef, payment: NormalizedPayment, opts: { recovered: boolean; graceUntil: string | null }): Promise<void> {
  try {
    if (payment.status !== "approved" && payment.status !== "rejected") return;
    const who = await userFacts(admin, sub);
    const facts: PaymentFacts = { ...who, amountMinor: payment.amountMinor, currency: payment.currency, at: payment.paidAt, providerPaymentId: payment.providerPaymentId, failureCode: payment.failureCode, firstPayment: false };
    const data = { provider, provider_payment_id: payment.providerPaymentId, amount_minor: payment.amountMinor, currency: payment.currency, email: who.email, plan: who.plan };
    if (payment.status === "approved") {
      facts.firstPayment = await isFirstPayment(admin, sub, payment);
      if (opts.recovered) {
        await resolveFailures(admin, sub);
        await notifyUser(admin, sub, "payment_recovered", userTexts.recovered(), `recovered:${provider}:${payment.providerPaymentId}`);
        await notifyAdmin(admin, "payment_recovered", sub, adminTexts.recovered(facts), `${provider}:${payment.providerPaymentId}:approved`, { ...data, first_payment: false });
      } else {
        await notifyAdmin(admin, "payment_approved", sub, adminTexts.approved(facts), `${provider}:${payment.providerPaymentId}:approved`, { ...data, first_payment: facts.firstPayment });
      }
      return;
    }
    // Débito rechazado: aviso al usuario (con el plazo de gracia) y al admin. Una vez por débito.
    const graceUntil = opts.graceUntil ?? new Date().toISOString();
    await notifyUser(admin, sub, "payment_failed", userTexts.failed(payment.failureCode, graceUntil), `failed:${provider}:${payment.providerPaymentId}`);
    await notifyAdmin(admin, "payment_failed", sub, adminTexts.failed(facts), `${provider}:${payment.providerPaymentId}:rejected`, { ...data, failure_code: payment.failureCode ?? null, grace_until: graceUntil });
  } catch (e) {
    logError("notify:payment", e);
  }
}

/** Tarea diaria: corta el acceso de las suscripciones cuya gracia venció sin cobro y avisa. */
export async function expireGracePeriods(admin: SupabaseClient, now = new Date()): Promise<number> {
  const { data } = await admin.from("subscriptions").select("id, user_id, grace_until").eq("status", "past_due").lt("grace_until", now.toISOString());
  const rows = (data ?? []) as (SubRef & { grace_until: string })[];
  let ended = 0;
  for (const sub of rows) {
    try {
      const { data: updated } = await admin.from("subscriptions").update({ status: "expired", grace_until: null }).eq("id", sub.id).eq("status", "past_due").select("id");
      if (!updated?.length) continue;
      ended++;
      await resolveFailures(admin, sub);
      const who = await userFacts(admin, sub);
      const key = `ended:${sub.id}:${sub.grace_until}`;
      await notifyUser(admin, sub, "access_ended", userTexts.ended(), key);
      await notifyAdmin(admin, "access_ended", sub, adminTexts.ended(who), key, { email: who.email, plan: who.plan });
    } catch (e) {
      logError("notify:expire", e);
    }
  }
  return ended;
}
