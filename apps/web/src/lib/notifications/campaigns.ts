import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, readEnv } from "@/lib/env";
import { logError } from "@/lib/log";
import { canonicalSiteUrl } from "@/lib/site-url";
import { birthdayEmail, campaignEmail, dueCampaign, type CampaignKind } from "./campaign-texts";
import { isUserEmailConfigured, sendUserEmailBatch } from "./email";

type BirthdayCandidate = { user_id: string; email: string; display_name: string | null; unsubscribe_token: string };
type Candidate = { user_id: string; email: string; display_name: string | null; premium: boolean; last_invite: string | null; last_encourage: string | null; unsubscribe_token: string };

/** Tope diario de envíos (el plan gratis de Resend permite 100 por día). Se cambia con EMAIL_CAMPAIGN_DAILY_LIMIT. */
function dailyLimit(): number {
  const n = Number(readEnv("EMAIL_CAMPAIGN_DAILY_LIMIT"));
  return Number.isInteger(n) && n > 0 ? n : 90;
}

const site = () => canonicalSiteUrl({ configured: publicEnv.configuredSiteUrl, vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL") }) || "https://runner360.ar";

type SendKind = CampaignKind | "birthday";
type Outgoing = { c: { user_id: string; email: string; display_name: string | null; unsubscribe_token: string }; kind: SendKind };

/**
 * Tarea diaria: felicitación a quienes cumplen años hoy, invitación semanal a quienes no tienen
 * suscripción y aliento cada 15 días a quienes sí. El cumpleaños va primero y ese día no se manda otro
 * correo a la misma persona. Sin remitente verificado no hace nada. Registra cada envío (uno por
 * persona, tipo y día).
 */
export async function runEmailCampaigns(admin: SupabaseClient, today: string): Promise<{ enabled: boolean; sent: Record<SendKind, number>; failed: number; pending: number }> {
  const result = { enabled: isUserEmailConfigured(), sent: { invite: 0, encourage: 0, birthday: 0 }, failed: 0, pending: 0 };
  if (!result.enabled) return result;
  const [{ data: birthdays, error: e1 }, { data, error }] = await Promise.all([
    admin.rpc("email_birthday_candidates", { p_today: today }),
    admin.rpc("email_campaign_candidates"),
  ]);
  if (e1) logError("campaigns:birthdays", { code: e1.code });
  if (error) logError("campaigns:candidates", { code: error.code });
  const party = ((birthdays ?? []) as BirthdayCandidate[]).map((c): Outgoing => ({ c, kind: "birthday" }));
  const celebrating = new Set(party.map((x) => x.c.user_id));
  const regular = ((data ?? []) as Candidate[])
    .filter((c) => !celebrating.has(c.user_id))
    .map((c) => ({ c, kind: dueCampaign(c, today) }))
    .filter((x): x is { c: Candidate; kind: CampaignKind } => x.kind !== null);
  const due: Outgoing[] = [...party, ...regular];
  const batch = due.slice(0, dailyLimit());
  result.pending = due.length - batch.length;
  const base = site();
  // De a 50 por llamada a Resend.
  for (let i = 0; i < batch.length; i += 50) {
    const chunk = batch.slice(i, i + 50);
    const ok = await sendUserEmailBatch(
      chunk.map(({ c, kind }) => {
        const unsubscribeUrl = `${base}/correos/baja?t=${c.unsubscribe_token}`;
        const oneClickUrl = `${base}/api/correos/baja?t=${c.unsubscribe_token}`;
        const mail =
          kind === "birthday"
            ? birthdayEmail({ name: c.display_name, today, siteUrl: base, unsubscribeUrl })
            : campaignEmail({ kind, name: c.display_name, today, siteUrl: base, unsubscribeUrl });
        return { to: c.email, oneClickUrl, ...mail };
      }),
    );
    if (!ok) {
      result.failed += chunk.length;
      continue;
    }
    for (const { kind } of chunk) result.sent[kind]++;
    const { error: e } = await admin
      .from("email_sends")
      .upsert(chunk.map(({ c, kind }) => ({ user_id: c.user_id, kind, sent_on: today })), { onConflict: "user_id,kind,sent_on", ignoreDuplicates: true });
    if (e) logError("campaigns:log", { code: e.code });
  }
  return result;
}
