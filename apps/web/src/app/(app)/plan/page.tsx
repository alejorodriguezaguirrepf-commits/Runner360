import { currentPlanWeek } from "@runner360/training-engine";
import { DISTANCE_LABELS, formatDate, LEVEL_LABELS, todayIn, WEEKDAY_SHORT } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { sessionVolumeLabel, StatusBadge } from "@/components/app/session-summary";
import { IconChevronRight } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { annualAccessUntil, requireOnboardedSession } from "@/lib/auth";
import { findPlan, getLibrary } from "@/lib/data/library";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { loadActivePlan } from "@/lib/data/training";
import { EnrollmentView } from "./enrollment-view";
import { CancelPlanButton, PlanFinishedCard } from "./plan-actions";

export const metadata: Metadata = { title: "Mi plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ inscripto?: string; semana?: string; checkin?: string }> }) {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const { inscripto } = await searchParams;
  const [openEnrollment, annualUntil] = await Promise.all([getOpenEnrollment(supabase, user.id), annualAccessUntil(session)]);
  if (openEnrollment) {
    const { semana, checkin } = await searchParams;
    return (
      <EnrollmentView
        open={openEnrollment}
        supabase={supabase}
        today={today}
        requestedWeek={semana}
        enrolled={Boolean(inscripto)}
        checkinDone={checkin}
        annual={Boolean(annualUntil)}
      />
    );
  }
  const active = await loadActivePlan(supabase, user.id);

  if (active) {
    const { version, userPlan, calendar } = active;
    const week = currentPlanWeek({ startDate: userPlan.start_date, startWeek: userPlan.start_week, durationWeeks: version.durationWeeks, today });
    const variant = version.scheduleVariants.find((v) => v.id === userPlan.variant_id);
    const byWeek = new Map<number, typeof calendar>();
    for (const item of calendar) byWeek.set(item.week_number, [...(byWeek.get(item.week_number) ?? []), item]);

    return (
      <>
        <PageHeader
          title={version.name}
          subtitle={`${DISTANCE_LABELS[version.distance] ?? version.distance} · ${LEVEL_LABELS[version.level]} · ${version.durationWeeks} semanas · versión ${version.versionNumber}`}
          actions={<CancelPlanButton />}
        />
        {inscripto ? <div className="mb-4"><Alert tone="success" title="¡Listo! Tu calendario está armado.">Empezás el {formatDate(userPlan.start_date, "long")}.</Alert></div> : null}
        {version.isDemo ? (
          <div className="mb-4">
            <Alert tone="warning" title="Plan DEMO / NO VALIDADO">
              Este plan es una estructura de ejemplo para probar la plataforma. No fue validado por un profesional y no constituye una prescripción.
            </Alert>
          </div>
        ) : null}
        <Card className="mb-6">
          <div className="grid gap-4 text-sm sm:grid-cols-4">
            <div><p className="text-muted">Semana actual</p><p className="text-lg font-bold">{week ? `${week} de ${version.durationWeeks}` : userPlan.start_date > today ? "Aún no comienza" : "Finalizado"}</p></div>
            <div><p className="text-muted">Inicio</p><p className="text-lg font-bold">{formatDate(userPlan.start_date)}</p></div>
            <div><p className="text-muted">Días</p><p className="text-lg font-bold">{variant?.weekdays.map((d) => WEEKDAY_SHORT[d - 1]).join(" · ") ?? "—"}</p></div>
            <div><p className="text-muted">Competencia</p><p className="text-lg font-bold">{userPlan.race_date ? formatDate(userPlan.race_date) : "Sin fecha"}</p></div>
          </div>
          {version.objective ? <p className="mt-4 text-sm text-muted">{version.objective}</p> : null}
        </Card>

        <div className="space-y-4">
          {[...byWeek.entries()].map(([weekNumber, items]) => {
            const meta = version.weeks.find((w) => w.weekNumber === weekNumber);
            return (
              <Card key={weekNumber} aria-labelledby={`semana-${weekNumber}`} className={weekNumber === week ? "ring-2 ring-primary" : undefined}>
                <CardTitle action={weekNumber === week ? <Badge tone="lime">Semana actual</Badge> : null}>
                  <span id={`semana-${weekNumber}`}>Semana {weekNumber}{meta?.focus ? ` · ${meta.focus}` : ""}</span>
                </CardTitle>
                <ul className="divide-y divide-line">
                  {items.map((it) => (
                    <li key={it.id}>
                      <Link href={`/plan/sesion/${it.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas">
                        <div className="w-24 shrink-0 text-sm">
                          <p className={`font-semibold ${it.scheduled_date === today ? "text-primary-ink" : ""}`}>{it.scheduled_date === today ? "Hoy" : formatDate(it.scheduled_date)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{it.session.title}</p>
                          <p className="text-xs text-muted">{sessionVolumeLabel(it.session)}</p>
                        </div>
                        <StatusBadge status={it.status} />
                        <IconChevronRight className="shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </>
    );
  }

  // Sin plan activo: los planes se eligen de la biblioteca (catálogo o asistente).
  // Último plan terminado: renovarlo o elegir otro.
  const { data: last } = await supabase
    .from("plan_enrollments")
    .select("id, plan_id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("ended_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ id: string; plan_id: string }>();
  const library = last ? await getLibrary() : null;
  const lastPlan = last && library ? findPlan(library, last.plan_id) : null;

  return (
    <>
      <PageHeader title="Tu plan" subtitle={t.library.catalog.subtitle} />
      {last && lastPlan ? <PlanFinishedCard enrollmentId={last.id} planTitle={lastPlan.title} annual={Boolean(annualUntil)} /> : null}
      <Card>
        <EmptyState
          title="Todavía no tenés un plan activo"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/planes">{t.library.catalog.choose}</ButtonLink>
              <ButtonLink href="/planes" variant="ghost">{t.library.catalog.title}</ButtonLink>
            </div>
          }
        />
      </Card>
    </>
  );
}
