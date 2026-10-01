import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatDuration, formatKm, formatPace, SESSION_TYPE_LABELS, WORKOUT_STATUS_LABELS } from "@runner360/shared";
import { paceSecondsPerKm } from "@runner360/training-engine";
import { PageHeader } from "@/components/app/page-header";
import { SessionMeta, sessionStatus } from "@/components/app/session-card";
import { Alert } from "@/components/ui/alert";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOnboardedViewer } from "@/lib/auth";
import { loadActivePlan } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";

export const metadata: Metadata = { title: "Sesión" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireOnboardedViewer("/app/plan");
  const supabase = await createClient();
  const plan = await loadActivePlan(supabase, viewer.id);
  const item = plan?.calendar.find((c) => c.id === id);
  if (!plan || !item) notFound();
  const today = todayKey(viewer.timezone);
  const st = sessionStatus(item, today);
  const { data: exercises } = await supabase
    .from("training_session_exercises")
    .select("sort_order, name, sets, reps, duration_s, rest_s, notes")
    .eq("session_id", item.session.id)
    .order("sort_order");
  const s = item.session;

  return (
    <>
      <Link href="/app/plan" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600">
        <ArrowLeft className="size-4" aria-hidden /> Volver al plan
      </Link>
      <PageHeader
        title={s.title}
        description={`${SESSION_TYPE_LABELS[s.type]} · Semana ${item.weekNumber} · ${formatDate(item.scheduledDate, { weekday: "long" })}`}
        action={<div className="flex gap-2"><Badge tone={st.tone}>{st.label}</Badge>{plan.version.isDemo ? <DemoBadge /> : null}</div>}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Objetivo" description={s.objective} />
          <SessionMeta item={item} />
          <ol className="mt-6 space-y-4">
            {[
              ["Calentamiento", s.warmup],
              ["Parte principal", s.mainSet],
              ["Vuelta a la calma", s.cooldown],
            ].map(([label, text]) =>
              text ? (
                <li key={label} className="rounded-xl bg-surface p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
                  <p className="mt-1 text-sm text-ink">{text}</p>
                </li>
              ) : null,
            )}
          </ol>
          {exercises && exercises.length > 0 ? (
            <div className="mt-6">
              <h2 className="mb-2 font-semibold text-navy">Ejercicios</h2>
              <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                {exercises.map((e) => (
                  <li key={e.sort_order as number} className="flex justify-between gap-3 p-3">
                    <span>{e.name as string}</span>
                    <span className="tabular text-muted">
                      {e.sets ? `${e.sets} × ` : ""}{e.reps ? `${e.reps} rep.` : e.duration_s ? formatDuration(e.duration_s as number) : ""}
                      {e.rest_s ? ` · pausa ${formatDuration(e.rest_s as number)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {s.notes ? <p className="mt-4 text-xs text-muted">{s.notes}</p> : null}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Tu registro" />
            {item.log ? (
              <dl className="tabular grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted">Estado</dt><dd className="font-semibold">{WORKOUT_STATUS_LABELS[item.log.status]}</dd></div>
                <div><dt className="text-muted">Distancia</dt><dd className="font-semibold">{formatKm(item.log.distanceM)}</dd></div>
                <div><dt className="text-muted">Duración</dt><dd className="font-semibold">{formatDuration(item.log.durationS)}</dd></div>
                <div><dt className="text-muted">Ritmo</dt><dd className="font-semibold">{formatPace(paceSecondsPerKm(item.log.distanceM, item.log.durationS))}</dd></div>
                <div><dt className="text-muted">RPE</dt><dd className="font-semibold">{item.log.rpe ?? "—"}</dd></div>
              </dl>
            ) : item.scheduledDate > today ? (
              <p className="text-sm text-muted">Podrás registrarla el día de la sesión.</p>
            ) : (
              <ButtonLink href={`/app/registrar?sesion=${item.id}`} className="w-full">Registrar esta sesión</ButtonLink>
            )}
          </Card>
          <Alert tone="warning" title="Cuándo reducir o suspender">{plan.version.reduceOrStopCriteria}</Alert>
        </div>
      </div>
    </>
  );
}
