import { currentPlanWeek } from "@runner360/training-engine";
import { DISTANCE_LABELS, formatDate, LEVEL_LABELS, todayIn, WEEKDAY_SHORT } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { sessionVolumeLabel, StatusBadge } from "@/components/app/session-summary";
import { IconChevronRight } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, DemoBadge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { hasPremium, requireOnboardedSession } from "@/lib/auth";
import { evaluateEnrollment, loadActivePlan, loadCatalog, loadTrainingProfile } from "@/lib/data/training";
import { enrollmentMessage } from "@/lib/enrollment-messages";
import { CancelPlanButton, EnrollButton } from "./plan-actions";

export const metadata: Metadata = { title: "Mi plan" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ inscripto?: string }> }) {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const { inscripto } = await searchParams;
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
          subtitle={`${DISTANCE_LABELS[version.distance]} · ${LEVEL_LABELS[version.level]} · ${version.durationWeeks} semanas · versión ${version.versionNumber}`}
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
              <Card key={weekNumber} aria-labelledby={`semana-${weekNumber}`} className={weekNumber === week ? "ring-2 ring-lime-400" : undefined}>
                <CardTitle action={weekNumber === week ? <Badge tone="lime">Semana actual</Badge> : null}>
                  <span id={`semana-${weekNumber}`}>Semana {weekNumber}{meta?.focus ? ` · ${meta.focus}` : ""}</span>
                </CardTitle>
                <ul className="divide-y divide-line">
                  {items.map((it) => (
                    <li key={it.id}>
                      <Link href={`/plan/sesion/${it.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas">
                        <div className="w-24 shrink-0 text-sm">
                          <p className={`font-semibold ${it.scheduled_date === today ? "text-lime-700" : ""}`}>{it.scheduled_date === today ? "Hoy" : formatDate(it.scheduled_date)}</p>
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

  // Sin plan activo: propuesta del motor + catálogo.
  const tp = await loadTrainingProfile(supabase, user.id, profile.birth_date);
  const premium = await hasPremium(session);
  const [proposal, catalog] = tp
    ? await Promise.all([
        evaluateEnrollment({ supabase, userId: user.id, profile: tp.profile, today, hasPremium: premium, commit: false }),
        loadCatalog(supabase),
      ])
    : [null, await loadCatalog(supabase)];
  const msg = proposal ? enrollmentMessage(proposal) : null;

  return (
    <>
      <PageHeader title="Tu plan" subtitle="Elegimos el plan publicado que corresponde a tu perfil. No inventamos sesiones." />
      {proposal?.kind === "enrolled" ? (
        <Card className="mb-6">
          <CardTitle action={proposal.result.version.isDemo ? <DemoBadge /> : <Badge tone="success">Validado</Badge>}>Plan recomendado</CardTitle>
          <p className="text-xl font-bold">{proposal.result.version.name}</p>
          <p className="mt-1 text-sm text-muted">
            {proposal.result.version.durationWeeks - proposal.result.startWeek + 1} semanas desde el {formatDate(proposal.result.startDate, "long")} ·{" "}
            {proposal.result.variant.label}
            {proposal.result.startWeek > 1 ? ` · comenzás en la semana ${proposal.result.startWeek}` : ""}
          </p>
          {proposal.result.version.isDemo ? (
            <p className="mt-3 text-sm text-warning">Es un plan de demostración no validado: usalo solo para conocer la plataforma.</p>
          ) : null}
          <div className="mt-4"><EnrollButton label="Comenzar este plan" /></div>
        </Card>
      ) : msg ? (
        <div className="mb-6 space-y-3">
          <Alert tone={msg.tone} title={msg.title}>{msg.text}</Alert>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/onboarding" variant="ghost">Revisar mi perfil de corredor</ButtonLink>
            {proposal?.kind === "premium_required" ? <ButtonLink href="/suscripcion">Ver Premium</ButtonLink> : null}
          </div>
        </div>
      ) : null}

      <Card>
        <CardTitle>Catálogo de planes publicados</CardTitle>
        {catalog.length === 0 ? (
          <EmptyState title="No hay planes publicados">Cuando el equipo publique planes, vas a verlos acá.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {catalog.map((c) => (
              <li key={c.versionId} className="flex flex-col gap-2 rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{c.name}</p>
                  {c.isDemo ? <DemoBadge /> : null}
                  {c.isPremium ? <Badge tone="navy">Premium</Badge> : <Badge tone="success">Gratis</Badge>}
                </div>
                <p className="text-xs text-muted">{c.durationWeeks} semanas · {c.sessionsPerWeek} sesiones por semana</p>
                {(!c.isPremium || premium) && tp ? (
                  <EnrollButton label="Usar este plan" versionId={c.versionId} variant="ghost" confirmText={`¿Querés comenzar "${c.name}"? Se verificarán los requisitos de ingreso.`} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
