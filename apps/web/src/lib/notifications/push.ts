import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { readEnv } from "@/lib/env";
import { logError } from "@/lib/log";

/**
 * Notificaciones push (Web Push con claves VAPID, sin servicios externos). Llegan a los dispositivos
 * donde la persona activó los avisos: navegador en Android y computadora; en iPhone, solo con la
 * app instalada en la pantalla de inicio (iOS 16.4 o posterior). Sin claves no se envía nada.
 */
export function vapidPublicKey(): string {
  return readEnv("VAPID_PUBLIC_KEY");
}

export function isPushConfigured(): boolean {
  return vapidPublicKey().length > 20 && readEnv("VAPID_PRIVATE_KEY").length > 20;
}

export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Envía a todos los dispositivos de esas personas. Borra las suscripciones que ya no existen. */
export async function sendPush(admin: SupabaseClient, userIds: string[], msg: PushMessage): Promise<number> {
  if (!isPushConfigured() || userIds.length === 0) return 0;
  webpush.setVapidDetails(readEnv("VAPID_SUBJECT") || "mailto:alejorodriguezaguirrepf@gmail.com", vapidPublicKey(), readEnv("VAPID_PRIVATE_KEY"));
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  const subs = (data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 24 * 60 * 60 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else logError("push", e);
      }
    }),
  );
  return sent;
}
