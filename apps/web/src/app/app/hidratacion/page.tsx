import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { BEVERAGE_LABELS, HYDRATION_CONTEXT_LABELS, WEEKDAY_SHORT, type BeverageType, type HydrationContext, type Weekday } from "@runner360/shared";
import { addDays, toLocalDateKey } from "@runner360/training-engine";
import { PageHeader } from "@/components/app/page-header";
import { HydrationForm, ReminderForm } from "@/components/app/hydration-forms";
import { PremiumLocked } from "@/components/premium/locked";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasFeature, requireOnboardedViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";
import { deleteHydrationAction, deleteReminderAction, toggleReminderAction } from "./actions";

export const metadata: Metadata = { title: "Hidratación" };

type Log = { id: string; logged_at: string; beverage_type: BeverageType; volume_ml: number | null; units: number | null; context: HydrationContext };

export default async function HydrationPage() {
  const viewer = await requireOnboardedViewer("/app/hidratacion");
  const enabled = hasFeature(viewer, "hydration");
  const supabase = await createClient();
  const today = todayKey(viewer.timezone);
  const [{ data: logs }, { data: reminders }] = await Promise.all([
    supabase.from("hydration_logs").select("id, logged_at, beverage_type, volume_ml, units, context")
      .eq("user_id", viewer.id).gte("logged_at", `${addDays(today, -1)}T00:00:00Z`).order("logged_at", { ascending: false }),
    supabase.from("hydration_reminders").select("id, label, time_of_day, weekdays, enabled").eq("user_id", viewer.id).order("time_of_day"),
  ]);
  const todays = ((logs ?? []) as Log[]).filter((l) => toLocalDateKey(l.logged_at, viewer.timezone) === today);
  const totalMl = todays.reduce((a, l) => a + (l.volume_ml ?? 0), 0);
  const gels = todays.filter((l) => l.beverage_type === "gel").reduce((a, l) => a + (l.units ?? 0), 0);
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: viewer.timezone }).format(new Date(iso));

  return (
    <>
      <PageHeader title="Hidratación" description="Registrá lo que tomás. La app no mide tu estado de hidratación." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Registrado hoy" value={`${totalMl.toLocaleString("es-AR")} ml`} />
        <Stat label="Registros hoy" value={todays.length} />
        <Stat label="Geles hoy" value={gels} />
      </div>
      {!enabled ? <div className="mt-4"><PremiumLocked feature="Hidratación" /></div> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {enabled ? (
          <Card>
            <CardHeader title="Nuevo registro" description="Agua, bebidas deportivas, electrolitos o geles en entrenamientos y competencias." />
            <HydrationForm />
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Hoy" />
          {todays.length === 0 ? <p className="text-sm text-muted">Sin registros hoy.</p> : (
            <ul className="divide-y divide-line text-sm">
              {todays.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="tabular">{fmtTime(l.logged_at)} · {BEVERAGE_LABELS[l.beverage_type]} · {l.volume_ml ? `${l.volume_ml} ml` : `${l.units} u.`}
                    <span className="block text-xs text-muted">{HYDRATION_CONTEXT_LABELS[l.context]}</span></span>
                  <form action={deleteHydrationAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <SubmitButton variant="ghost" size="sm" pendingText="…" aria-label="Eliminar registro"><Trash2 className="size-4" aria-hidden /></SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recordatorios" description="Se guardan en tu cuenta. Las notificaciones se enviarán desde la app móvil (en desarrollo)." />
          <ul className="mb-4 divide-y divide-line text-sm">
            {(reminders ?? []).map((r) => (
              <li key={r.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{r.label as string} · <span className="tabular">{String(r.time_of_day).slice(0, 5)}</span>
                  <span className="block text-xs text-muted">{(r.weekdays as number[]).map((d) => WEEKDAY_SHORT[d as Weekday]).join(" ")}</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "Activo" : "Pausado"}</Badge>
                  <form action={toggleReminderAction}>
                    <input type="hidden" name="id" value={r.id as string} />
                    <input type="hidden" name="enabled" value={r.enabled ? "false" : "true"} />
                    <SubmitButton variant="ghost" size="sm" pendingText="…">{r.enabled ? "Pausar" : "Activar"}</SubmitButton>
                  </form>
                  <form action={deleteReminderAction}>
                    <input type="hidden" name="id" value={r.id as string} />
                    <SubmitButton variant="ghost" size="sm" pendingText="…" aria-label="Eliminar recordatorio"><Trash2 className="size-4" aria-hidden /></SubmitButton>
                  </form>
                </span>
              </li>
            ))}
            {(reminders ?? []).length === 0 ? <li className="py-2 text-muted">Sin recordatorios.</li> : null}
          </ul>
          {enabled ? <ReminderForm /> : null}
        </Card>
        <Card>
          <CardHeader title="Recomendaciones orientativas" />
          <ul className="list-disc space-y-2 pl-5 text-sm text-ink">
            <li>No existe una cantidad de agua universal: depende del clima, la duración e intensidad, tu tamaño corporal y tu sudoración.</li>
            <li>En sesiones prolongadas o con calor, planificá con anticipación cómo vas a hidratarte.</li>
            <li>Tomar en exceso también puede ser riesgoso. No fuerces la ingesta sin indicación profesional.</li>
            <li>Probá geles y bebidas deportivas en entrenamientos antes de usarlos en competencia.</li>
          </ul>
          <Alert tone="warning" className="mt-4">
            Ante mareos, confusión, náuseas, calambres intensos, fiebre o enfermedad, detené la actividad y consultá a un profesional de la salud.
          </Alert>
          <a href="/app/contenidos" className="mt-4 inline-block text-sm font-semibold text-navy-600 underline">Leer más en Aprender</a>
        </Card>
      </div>
    </>
  );
}
