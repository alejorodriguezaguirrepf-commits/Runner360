"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin, requireSession } from "@/lib/auth";
import { todayIn } from "@runner360/shared";
import { logError } from "@/lib/log";
import { runEmailCampaigns } from "@/lib/notifications/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin: marca una notificación (o todas) como leída. */
export async function markAdminNotificationReadAction(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  const now = new Date().toISOString();
  const query = supabase.from("admin_notifications").update({ read_at: now }).is("read_at", null);
  const { error } = id.success ? await query.eq("id", id.data) : await query.not("id", "is", null);
  if (error) logError("notifications:read", error);
  revalidatePath("/admin", "layout");
}

/** Admin: canales de aviso fuera de la app (mail y push). */
export async function updateAdminChannelsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("notification_settings")
    .update({ admin_email_enabled: formData.get("email") === "on", admin_push_enabled: formData.get("push") === "on", updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) {
    logError("notifications:channels", error);
    return { ok: false, message: "No pudimos guardar los canales. Probá de nuevo." };
  }
  revalidatePath("/admin/notificaciones");
  return { ok: true, message: "Canales guardados." };
}

const pushSchema = z.object({
  endpoint: z.url().startsWith("https://").max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
});

/** Guarda la suscripción push de este dispositivo (cualquier usuario, para sí mismo). */
export async function savePushSubscriptionAction(sub: unknown): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireSession();
  const parsed = pushSchema.safeParse(sub);
  if (!parsed.success) return { ok: false };
  // Si el dispositivo ya estaba registrado (por otra cuenta o por esta), se reemplaza.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ user_id: user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth });
  if (error) logError("push:save", error);
  return { ok: !error };
}

export async function deletePushSubscriptionAction(endpoint: unknown): Promise<{ ok: boolean }> {
  const { supabase } = await requireSession();
  if (typeof endpoint !== "string") return { ok: false };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: !error };
}

/** Usuario: cierra el aviso de pago regularizado o de acceso pausado. */
export async function markNoticeSeenAction(formData: FormData): Promise<void> {
  const { supabase } = await requireSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { error } = await supabase.from("user_notices").update({ seen_at: new Date().toISOString() }).eq("id", id.data);
  if (error) logError("notices:seen", error);
  revalidatePath("/", "layout");
}

/**
 * Admin: manda ahora los correos de motivación que tocan hoy (lo mismo que hace la tarea diaria). Es
 * seguro repetirlo: cada persona recibe uno por tipo y día, y la frecuencia se respeta.
 */
export async function sendCampaignsNowAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  const { emailSetupProblems } = await import("@/lib/notifications/campaign-status");
  const problems = emailSetupProblems().filter((p) => !p.includes("CRON_SECRET"));
  if (problems.length) return { ok: false, message: problems.join(" ") };
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Falta la clave de servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY) en Vercel." };
  try {
    const r = await runEmailCampaigns(admin, todayIn("America/Argentina/Buenos_Aires"));
    revalidatePath("/admin/notificaciones");
    const total = r.sent.invite + r.sent.encourage + r.sent.birthday;
    const parts = [`${r.sent.invite} invitaciones`, `${r.sent.encourage} de aliento`, `${r.sent.birthday} de cumpleaños`];
    if (r.failed) return { ok: false, message: `No se pudieron enviar ${r.failed} correos. Enviados: ${parts.join(", ")}. Revisá la clave y el dominio en Resend.` };
    if (!total) return { ok: true, message: "Hoy no había correos pendientes: a todos ya les llegó el de esta semana." };
    return { ok: true, message: `Enviados: ${parts.join(", ")}.${r.pending ? ` Quedan ${r.pending} para mañana (tope diario).` : ""}` };
  } catch (e) {
    logError("campaigns:manual", e);
    return { ok: false, message: "No se pudieron enviar los correos. Probá de nuevo en un rato." };
  }
}
