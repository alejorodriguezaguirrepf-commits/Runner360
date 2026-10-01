import type { Metadata } from "next";
import Link from "next/link";
import { CalendarX2, ClipboardList, Stethoscope } from "lucide-react";
import {
  formatDate,
  formatDuration,
  RACE_DISTANCE_LABELS,
  RUNNER_LEVEL_LABELS,
  WEEKDAY_SHORT,
  type Weekday,
} from "@runner360/shared";
import { evaluateWeek, planWeekForDate, selectPlan, type PlanSelection, type PlanVersion } from "@runner360/training-engine";
import { PageHeader } from "@/components/app/page-header";
import { SessionRow } from "@/components/app/session-card";
import { Alert } from "@/components/ui/alert";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasFeature, requireOnboardedViewer } from "@/lib/auth";
import { loadPublishedCatalog } from "@/lib/data/plans";
import { loadActivePlan, loadRunnerProfile, type ActivePlan } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";
import { abandonPlanAction, startPlanAction } from "./actions";

export const metadata: Metadata = { title: "Mi plan" };

const ERRORS: Record<string, string> = {
  seleccion: "La recomendación cambió. Revisá la sugerencia actualizada.",
  acceso: "No tenés acceso a ese plan con tu suscripción actual.",
  guardar: "No pudimos iniciar el plan. Intentá nuevamente.",
  datos: "El plan tiene datos incompletos. Avisá al equipo desde tu perfil.",
  inicio: "No se pudo calcular la fecha de inicio.",
};

export default async function PlanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer("/app/plan");
  const supabase = await createClient();
  const today = todayKey(viewer.timezone);
  const active = await loadActivePlan(supabase, viewer.id);

  return (
    <>
      {sp.error && ERRORS[sp.error] ? <Alert tone="danger" className="mb-4">{ERRORS[sp.error]}</Alert> : null}
      {sp.iniciado ? <Alert tone="success" className="mb-4" title="¡Plan iniciado!">Tu calendario ya está listo.</Alert> : null}
      {active ? (
        <ActivePlanView plan={active} today={today} />
      ) : (
        <Recommendation viewerId={viewer.id} today={today} premium={hasFeature(viewer, "premium_plans")} />
      )}
    </>
  );
}

function PlanSummary({ version }: { version: PlanVersion }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge tone="navy">{RACE_DISTANCE_LABELS[version.targetDistance]}</Badge>
        <Badge>{RUNNER_LEVEL_LABELS[version.level]}</Badge>
        <Badge>{version.durationWeeks} semanas</Badge>
        <Badge>{version.sessionsPerWeek} sesiones por semana</Badge>
        {version.isDemo ? <DemoBadge /> : null}
      </div>
      <p className="text-ink">{version.objective}</p>
      {version.isDemo ? (
        <Alert tone="warning">
          Este es un plan de demostración: no fue validado por un profesional y no constituye una prescripción. Usalo solo para
          conocer la app.
        </Alert>
      ) : null}
      <details className="rounded-xl bg-surface p-3">
        <summary className="cursor-pointer font-medium text-navy">Criterios de progresión y de suspensión</summary>
        <p className="mt-2"><strong>Progresión:</strong> {version.progressionCriteria}</p>
        <p className="mt-2"><strong>Reducir o suspender:</strong> {version.reduceOrStopCriteria}</p>
      </details>
    </div>
  );
}

async function Recommendation({ viewerId, today, premium }: { viewerId: string; today: string; premium: boolean }) {
  const supabase = await createClient();
  const profile = await loadRunnerProfile(supabase, viewerId);
  if (!profile) {
    return (
      <EmptyState icon={ClipboardList} title="Completá tu perfil de corredor" action={<ButtonLink href="/onboarding">Completar perfil</ButtonLink>}>
        Necesitamos algunos datos para sugerirte un plan.
      </EmptyState>
    );
  }
  const catalog = await loadPublishedCatalog(supabase);
  const selection: PlanSelection = selectPlan(profile.runner, catalog, today, { premiumPlans: premium });

  return (
    <>
      <PageHeader title="Tu plan sugerido" description="Calculado a partir de tu perfil con reglas fijas y verificables." />
      {selection.kind === "plan" ? (
        <Card>
          <CardHeader title={selection.version.name} />
          <PlanSummary version={selection.version} />
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Comienza</dt><dd className="font-semibold text-navy">{formatDate(selection.startDate, { weekday: "long" })}</dd></div>
            <div><dt className="text-muted">Semana inicial</dt><dd className="font-semibold text-navy">{selection.startWeek}</dd></div>
            <div>
              <dt className="text-muted">Días de entrenamiento</dt>
              <dd className="font-semibold text-navy">{selection.schedule.weekdayPattern.map((d) => WEEKDAY_SHORT[d as Weekday]).join(" · ")}</dd>
            </div>
          </dl>
          {selection.notes.map((n) => <p key={n} className="mt-3 text-sm text-muted">{n}</p>)}
          <form action={startPlanAction} className="mt-6">
            <input type="hidden" name="choice" value="recommended" />
            <SubmitButton size="lg" pendingText="Preparando tu calendario…">Comenzar este plan</SubmitButton>
          </form>
        </Card>
      ) : null}

      {selection.kind === "introductory_recommended" ? (
        <Card>
          <CardHeader title="Te recomendamos empezar con una fase introductoria" />
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-ink">
            {selection.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {selection.version ? (
            <>
              <h3 className="mb-2 font-semibold text-navy">{selection.version.name}</h3>
              <PlanSummary version={selection.version} />
              {selection.schedule ? (
                <form action={startPlanAction} className="mt-6">
                  <input type="hidden" name="choice" value="introductory" />
                  <SubmitButton size="lg" pendingText="Preparando tu calendario…">Comenzar fase introductoria</SubmitButton>
                </form>
              ) : (
                <Alert tone="warning" className="mt-4">
                  Con tus días disponibles no hay una distribución validada para este plan. Se necesita una configuración profesional.
                </Alert>
              )}
            </>
          ) : (
            <Alert className="mt-2">Todavía no hay una fase introductoria publicada. Consultá con un profesional antes de empezar.</Alert>
          )}
        </Card>
      ) : null}

      {selection.kind === "professional_review_required" ? (
        <EmptyState icon={Stethoscope} title="Antes de empezar, consultá con un profesional" action={<ButtonLink href="/onboarding" variant="secondary">Actualizar mi perfil</ButtonLink>}>
          {selection.reasons.join(" ")} Cuando cuentes con el alta, actualizá tus antecedentes en el perfil.
        </EmptyState>
      ) : null}

      {selection.kind === "needs_schedule_configuration" || selection.kind === "insufficient_time" || selection.kind === "no_plan_available" ? (
        <EmptyState icon={CalendarX2} title="No podemos asignarte un plan automáticamente" action={<ButtonLink href="/onboarding" variant="secondary">Revisar mi perfil</ButtonLink>}>
          {selection.reasons.join(" ")}
          {selection.kind === "insufficient_time" ? " Podés elegir una competencia más lejana u otra distancia." : ""}
        </EmptyState>
      ) : null}

      {selection.kind === "premium_required" ? (
        <EmptyState icon={ClipboardList} title="Este plan es Premium" action={<ButtonLink href="/app/suscripcion">Ver Premium</ButtonLink>}>
          {selection.version.name} está incluido en la suscripción Premium.
        </EmptyState>
      ) : null}
    </>
  );
}

function ActivePlanView({ plan, today }: { plan: ActivePlan; today: string }) {
  const v = plan.version;
  const currentWeek = planWeekForDate({ startDate: plan.startDate, startWeek: plan.startWeek, durationWeeks: v.durationWeeks, date: today });
  const weeks = new Map<number, typeof plan.calendar>();
  for (const item of plan.calendar) weeks.set(item.weekNumber, [...(weeks.get(item.weekNumber) ?? []), item]);

  // Sugerencia de progresión sobre la semana anterior (solo informativa).
  const prev = currentWeek && currentWeek > plan.startWeek ? weeks.get(currentWeek - 1) : undefined;
  const advice = prev
    ? evaluateWeek(
        {
          plannedSessions: prev.filter((i) => i.session.type !== "rest").length,
          doneSessions: prev.filter((i) => i.log && i.log.status !== "skipped").length,
          rpe: prev.filter((i) => i.log).map((i) => ({ reported: i.log!.rpe, plannedMax: i.session.rpeMax })),
        },
        v.progressionRules,
      )
    : null;

  return (
    <>
      <PageHeader
        title={v.name}
        description={`Inicio: ${formatDate(plan.startDate)}${plan.raceDate ? ` · Competencia: ${formatDate(plan.raceDate)}` : ""}`}
        action={v.isDemo ? <DemoBadge /> : <Badge tone="success">Plan validado</Badge>}
      />
      {currentWeek == null && today < plan.startDate ? (
        <Alert className="mb-4">Tu plan comienza el {formatDate(plan.startDate, { weekday: "long" })}.</Alert>
      ) : null}
      {advice && advice.kind !== "insufficient_data" ? (
        <Alert tone={advice.kind === "continue" ? "success" : "warning"} className="mb-4" title="Revisión de la semana anterior">
          {advice.message} <span className="text-muted">(Sugerencia automática basada en reglas del plan; no modifica tu calendario.)</span>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {[...weeks.entries()].map(([week, items]) => {
          const plannedS = items.reduce((a, i) => a + (i.session.durationS ?? 0), 0);
          const isCurrent = week === currentWeek;
          return (
            <details key={week} open={isCurrent || (currentWeek == null && week === plan.startWeek)} className="group rounded-2xl border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <span className="flex items-center gap-2 font-semibold text-navy">
                  Semana {week}
                  {isCurrent ? <Badge tone="lime">Actual</Badge> : null}
                </span>
                <span className="tabular text-sm text-muted">{formatDuration(plannedS)} planificados</span>
              </summary>
              <div className="space-y-2 px-4 pb-4">
                {items.map((i) => <SessionRow key={i.id} item={i} today={today} />)}
              </div>
            </details>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader title="Sobre este plan" as="h2" />
        <PlanSummary version={v} />
        <form action={abandonPlanAction} className="mt-6 flex flex-wrap items-center gap-3">
          <input type="hidden" name="userPlanId" value={plan.id} />
          <SubmitButton variant="secondary" pendingText="Procesando…">Dejar este plan y ver otra sugerencia</SubmitButton>
          <p className="text-xs text-muted">Tu historial y registros se conservan.</p>
        </form>
        <p className="mt-4 text-xs text-muted">
          ¿Cambió tu disponibilidad u objetivo? <Link href="/onboarding" className="underline">Actualizá tu perfil</Link>.
        </p>
      </Card>
    </>
  );
}
