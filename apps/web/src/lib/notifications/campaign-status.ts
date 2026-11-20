import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";
import { readEnv } from "@/lib/env";
import { dueCampaign, type CampaignKind } from "./campaign-texts";
import { isEmailConfigured, isUserEmailConfigured } from "./email";

export type SendKind = CampaignKind | "birthday";

/** Qué falta configurar para que salgan los correos a usuarios (vacío: todo listo). */
export function emailSetupProblems(): string[] {
  const problems: string[] = [];
  if (!isEmailConfigured()) problems.push("Falta la clave de Resend (RESEND_API_KEY) en Vercel.");
  const from = readEnv("RESEND_FROM");
  if (!from.includes("@")) problems.push("Falta el remitente (RESEND_FROM), por ejemplo RUNNER 360 <hola@runner360.ar>.");
  else if (from.includes("resend.dev")) problems.push("El remitente es el de prueba de Resend: hay que verificar el dominio runner360.ar en Resend y usar una dirección de ese dominio.");
  if (!serverEnv.cronSecret) problems.push("Falta CRON_SECRET en Vercel: sin esa clave la tarea diaria no corre.");
  return problems;
}

export type CampaignStatus = {
  ready: boolean;
  problems: string[];
  sent: Record<SendKind, { total: number; last: string | null }>;
  /** Cuántas personas tienen un correo pendiente hoy (invitación o aliento). */
  dueToday: Record<CampaignKind, number>;
};

/** Estado de los correos de motivación para el panel (con la conexión de servicio). */
export async function campaignStatus(admin: SupabaseClient | null, today: string): Promise<CampaignStatus> {
  const problems = emailSetupProblems();
  const sent: CampaignStatus["sent"] = { invite: { total: 0, last: null }, encourage: { total: 0, last: null }, birthday: { total: 0, last: null } };
  const dueToday = { invite: 0, encourage: 0 };
  if (admin) {
    const [{ data: sends }, { data: candidates }] = await Promise.all([
      admin.from("email_sends").select("kind, sent_on").order("sent_on", { ascending: false }).limit(5000),
      admin.rpc("email_campaign_candidates"),
    ]);
    for (const s of (sends ?? []) as { kind: SendKind; sent_on: string }[]) {
      const k = sent[s.kind];
      if (!k) continue;
      k.total += 1;
      if (!k.last || s.sent_on > k.last) k.last = s.sent_on;
    }
    for (const c of (candidates ?? []) as { premium: boolean; last_invite: string | null; last_encourage: string | null }[]) {
      const kind = dueCampaign(c, today);
      if (kind) dueToday[kind] += 1;
    }
  } else {
    problems.push("Falta la clave de servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY) en Vercel.");
  }
  return { ready: problems.length === 0 && isUserEmailConfigured(), problems, sent, dueToday };
}
