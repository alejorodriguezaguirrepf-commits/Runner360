import { BEVERAGE_LABELS, formatDate, HYDRATION_CONTEXT_LABELS, todayIn, WEEKDAY_SHORT, type ContentRow, type HydrationLogRow, type HydrationReminderRow } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { canUseFeature, requireOnboardedSession } from "@/lib/auth";
import { deleteHydrationAction, deleteReminderAction, toggleReminderAction } from "@/lib/actions/modules";
import { HydrationForm, ReminderForm } from "./hydration-forms";

export const metadata: Metadata = { title: "Hidratación" };

const nf = new Intl.NumberFormat("es-AR");

export default async function HydrationPage() {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const allowed = await canUseFeature(session, "hydration");
  const { data: contents } = await supabase.from("educational_contents").select("slug, title, summary, reviewed_by").eq("category", "hydration").eq("status", "published");
  const education = (
    <Card>
      <CardTitle>Recomendaciones educativas</CardTitle>
      <ul className="space-y-3">
        {((contents ?? []) as Pick<ContentRow, "slug" | "title" | "summary" | "reviewed_by">[]).map((c) => (
          <li key={c.slug}>
            <Link href={`/aprender/${c.slug}`} className="font-semibold text-navy-700 hover:underline">{c.title}</Link>
            {!c.reviewed_by ? <Badge tone="warning" className="ml-2">Pendiente de revisión profesional</Badge> : null}
            <p className="text-sm text-muted">{c.summary}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
  const disclaimer = (
    <Alert tone="info" title="Orientativo, no prescriptivo">
      No existe una cantidad de agua universal. La app registra lo que cargás; no mide tu estado de hidratación. Con calor, sesiones prolongadas, enfermedad o medicación, consultá a un profesional.
    </Alert>
  );

  if (!allowed) {
    return (
      <>
        <PageHeader title="Hidratación" />
        <div className="space-y-4">{disclaimer}<PremiumGate feature="Hidratación" />{education}</div>
      </>
    );
  }

  const [{ data: logs }, { data: reminders }] = await Promise.all([
    supabase.from("hydration_logs").select("*").eq("user_id", user.id).eq("log_date", today).order("logged_at", { ascending: false }),
    supabase.from("hydration_reminders").select("*").eq("user_id", user.id).order("time_of_day"),
  ]);
  const todayLogs = (logs ?? []) as HydrationLogRow[];
  const totalMl = todayLogs.reduce((a, l) => a + l.volume_ml, 0);
  const carbs = todayLogs.reduce((a, l) => a + (l.carbs_g ?? 0), 0);

  return (
    <>
      <PageHeader title="Hidratación" subtitle={formatDate(today, "weekday")} />
      <div className="space-y-4">
        {disclaimer}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Registrado hoy" value={`${nf.format(totalMl)} ml`} />
          <Stat label="Registros" value={todayLogs.length} />
          <Stat label="Carbohidratos" value={`${carbs} g`} hint="geles y bebidas" />
        </div>
        <Card>
          <CardTitle>Agregar registro</CardTitle>
          <HydrationForm today={today} />
        </Card>
        <Card>
          <CardTitle>Hoy</CardTitle>
          {todayLogs.length === 0 ? <EmptyState title="Sin registros hoy" /> : (
            <ul className="divide-y divide-line text-sm">
              {todayLogs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold">{BEVERAGE_LABELS[l.beverage]}</span> · {l.volume_ml > 0 ? `${nf.format(l.volume_ml)} ml` : "sin volumen"}
                    {l.carbs_g ? ` · ${l.carbs_g} g CH` : ""} <span className="text-muted">({HYDRATION_CONTEXT_LABELS[l.context].toLowerCase()})</span>
                  </span>
                  <form action={deleteHydrationAction}><input type="hidden" name="id" value={l.id} /><button className="min-h-11 px-2 text-xs font-semibold text-danger">Eliminar</button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Recordatorios</CardTitle>
          <p className="mb-3 text-sm text-muted">Las notificaciones se envían desde la app móvil (en desarrollo). En la web podés configurar los horarios.</p>
          {((reminders ?? []) as HydrationReminderRow[]).length > 0 ? (
            <ul className="mb-4 divide-y divide-line text-sm">
              {((reminders ?? []) as HydrationReminderRow[]).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><span className="font-semibold">{r.time_of_day.slice(0, 5)}</span> · {r.label} · {r.weekdays.map((d) => WEEKDAY_SHORT[d - 1]).join(" ")}</span>
                  <span className="flex items-center gap-1">
                    <form action={toggleReminderAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="enabled" value={String(!r.enabled)} />
                      <button className="min-h-11 px-2 text-xs font-semibold text-navy-700">{r.enabled ? "Desactivar" : "Activar"}</button>
                    </form>
                    <form action={deleteReminderAction}><input type="hidden" name="id" value={r.id} /><button className="min-h-11 px-2 text-xs font-semibold text-danger">Eliminar</button></form>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <ReminderForm />
        </Card>
        {education}
      </div>
    </>
  );
}
