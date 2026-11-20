import type { Metadata } from "next";
import Link from "next/link";
import { PushToggle } from "@/components/notifications/push-toggle";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { markAdminNotificationReadAction } from "@/lib/actions/notifications";
import { requireAdmin } from "@/lib/auth";
import { adminEmailAddress, isEmailConfigured } from "@/lib/notifications/email";
import { formatDateTime } from "@/lib/notifications/payment-texts";
import { isPushConfigured, vapidPublicKey } from "@/lib/notifications/push";
import { cx } from "@/components/ui/primitives";
import { todayIn } from "@runner360/shared";
import { campaignStatus } from "@/lib/notifications/campaign-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChannelsForm } from "./channels-form";
import { SendCampaignsForm } from "./send-campaigns-form";

export const metadata: Metadata = { title: "Notificaciones", robots: { index: false, follow: false } };

const KINDS = {
  payment_approved: { label: "Pagos acreditados", tone: "success" },
  payment_recovered: { label: "Pagos regularizados", tone: "success" },
  payment_failed: { label: "Débitos rechazados", tone: "warning" },
  access_ended: { label: "Accesos cortados", tone: "danger" },
} as const;
type Kind = keyof typeof KINDS;

type Row = { id: string; kind: Kind; title: string; body: string; data: { email?: string }; read_at: string | null; created_at: string };

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { supabase } = await requireAdmin();
  const { tipo } = await searchParams;
  const kind = tipo && tipo in KINDS ? (tipo as Kind) : null;
  let query = supabase.from("admin_notifications").select("id, kind, title, body, data, read_at, created_at").order("created_at", { ascending: false }).limit(100);
  if (kind) query = query.eq("kind", kind);
  const [{ data }, { data: settings }] = await Promise.all([
    query,
    supabase.from("notification_settings").select("admin_email_enabled, admin_push_enabled").maybeSingle<{ admin_email_enabled: boolean; admin_push_enabled: boolean }>(),
  ]);
  const rows = (data ?? []) as Row[];
  const mail = await campaignStatus(createAdminClient(), todayIn("America/Argentina/Buenos_Aires"));
  const day = (d: string | null) => (d ? `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}/${d.slice(2, 4)}` : "nunca");
  const unread = rows.filter((r) => !r.read_at).length;
  const chip = (k: Kind | null, label: string) => (
    <Link
      key={k ?? "todas"}
      href={k ? `/admin/notificaciones?tipo=${k}` : "/admin/notificaciones"}
      aria-current={kind === k ? "page" : undefined}
      className={cx("inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-semibold", kind === k ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface text-ink")}
    >
      {label}
    </Link>
  );

  return (
    <>
      <PageHeader title="Notificaciones" subtitle="Pagos acreditados, débitos rechazados y accesos cortados." />
      <div className="space-y-6">
        <Card>
          <CardTitle action={<Badge tone={mail.ready ? "success" : "danger"}>{mail.ready ? "Funcionando" : "Sin enviar"}</Badge>}>Correos a usuarios</CardTitle>
          <p className="text-sm text-muted">
            Todos los días a la mañana se manda la invitación semanal a quienes no tienen suscripción (asunto «SUSCRIPCIÓN A RUNNER 360»), el aliento cada
            15 días a quienes sí la tienen y el saludo de cumpleaños.
          </p>
          {mail.problems.length ? (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger-bg p-3">
              <p className="text-sm font-semibold text-danger">No se están enviando correos porque:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
                {mail.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ) : null}
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted">Invitaciones a suscribirse</dt><dd className="font-semibold">{mail.sent.invite.total} · última: {day(mail.sent.invite.last)}</dd></div>
            <div><dt className="text-xs text-muted">Aliento a suscriptos</dt><dd className="font-semibold">{mail.sent.encourage.total} · último: {day(mail.sent.encourage.last)}</dd></div>
            <div><dt className="text-xs text-muted">Cumpleaños</dt><dd className="font-semibold">{mail.sent.birthday.total} · último: {day(mail.sent.birthday.last)}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-muted">
            Pendientes hoy: {mail.dueToday.invite} {mail.dueToday.invite === 1 ? "invitación" : "invitaciones"} y {mail.dueToday.encourage} de aliento.
          </p>
          <div className="mt-3">
            <SendCampaignsForm disabled={!mail.ready && mail.problems.some((p) => !p.includes("CRON_SECRET"))} />
          </div>
        </Card>
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          {chip(null, "Todas")}
          {(Object.keys(KINDS) as Kind[]).map((k) => chip(k, KINDS[k].label))}
        </nav>
        {unread ? (
          <form action={markAdminNotificationReadAction}>
            <button className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink">Marcar todas como leídas</button>
          </form>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState title="Sin notificaciones" />
        ) : (
          <ul className="space-y-3">
            {rows.map((n) => (
              <li key={n.id}>
                <Card className={cx(!n.read_at && "border-primary")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        {!n.read_at ? <span className="sr-only">Sin leer: </span> : null}
                        {n.title}
                      </p>
                      <p className="mt-1 text-sm text-muted">{n.body}</p>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at)}</p>
                    </div>
                    <Badge tone={KINDS[n.kind].tone}>{KINDS[n.kind].label}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.data.email ? (
                      <Link href={`/admin/usuarios?q=${encodeURIComponent(n.data.email)}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold text-primary-ink">
                        Ver usuario
                      </Link>
                    ) : null}
                    {!n.read_at ? (
                      <form action={markAdminNotificationReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted hover:text-ink">Marcar como leída</button>
                      </form>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <Card>
          <CardTitle>Avisos fuera de la app</CardTitle>
          <ChannelsForm
            email={settings?.admin_email_enabled ?? true}
            push={settings?.admin_push_enabled ?? true}
            emailReady={isEmailConfigured()}
            pushReady={isPushConfigured()}
            emailTo={adminEmailAddress()}
          />
          {isPushConfigured() ? (
            <div className="mt-4 border-t border-line pt-4">
              <PushToggle vapidPublicKey={vapidPublicKey()} label="Push en este dispositivo" />
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
