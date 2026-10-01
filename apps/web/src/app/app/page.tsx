import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Droplets, LineChart, PlusCircle, Sparkles, UserRound } from "lucide-react";
import { formatDate, formatDuration, formatKm, SESSION_TYPE_LABELS } from "@runner360/shared";
import { computeCompliance, diffDays, planWeekForDate, startOfIsoWeek, addDays, totals, toLocalDateKey } from "@runner360/training-engine";
import { MobileMoreLinks } from "@/components/app/app-nav";
import { SessionMeta } from "@/components/app/session-card";
import { Alert } from "@/components/ui/alert";
import { DemoBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { isStaff, requireOnboardedViewer } from "@/lib/auth";
import { loadActivePlan, loadWorkouts, toWorkoutLike } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer();
  const supabase = await createClient();
  const today = todayKey(viewer.timezone);
  const weekStart = startOfIsoWeek(today);
  const [plan, recent] = await Promise.all([
    loadActivePlan(supabase, viewer.id),
    loadWorkouts(supabase, viewer.id, new Date(Date.now() - 9 * 86_400_000).toISOString()),
  ]);
  const thisWeekLogs = recent.filter((w) => {
    const d = toLocalDateKey(w.started_at, viewer.timezone);
    return d >= weekStart && d <= addDays(weekStart, 6);
  });
  const weekDone = totals(thisWeekLogs.map(toWorkoutLike));

  const weekItems = plan?.calendar.filter((c) => c.scheduledDate >= weekStart && c.scheduledDate <= addDays(weekStart, 6)) ?? [];
  const plannedDistance = weekItems.reduce((a, i) => a + (i.session.distanceM ?? 0), 0);
  const plannedDuration = weekItems.reduce((a, i) => a + (i.session.durationS ?? 0), 0);
  const weekCompleted = weekItems.filter((i) => i.log && i.log.status !== "skipped").length;
  const weekPlanned = weekItems.filter((i) => i.session.type !== "rest").length;
  const next = plan?.calendar.find((c) => c.scheduledDate >= today && !c.log && c.session.type !== "rest");
  const currentWeek = plan
    ? planWeekForDate({ startDate: plan.startDate, startWeek: plan.startWeek, durationWeeks: plan.version.durationWeeks, date: today })
    : null;
  const compliance = plan
    ? computeCompliance(
        plan.calendar.map((c) => ({ id: c.id, scheduledDate: c.scheduledDate, isRest: c.session.type === "rest", logStatus: c.log?.status ?? null })),
        today,
      )
    : null;
  const lastDate = plan?.calendar.at(-1)?.scheduledDate;
  const totalDays = plan && lastDate ? Math.max(1, diffDays(plan.startDate, lastDate)) : 1;
  const elapsed = plan ? Math.max(0, Math.min(totalDays, diffDays(plan.startDate, today))) : 0;
  const daysToRace = plan?.raceDate ? diffDays(today, plan.raceDate) : null;

  return (
    <>
      {sp.error === "permisos" ? <Alert tone="danger" className="mb-4">No tenés permisos para acceder a esa sección.</Alert> : null}
      {sp.mensaje === "contrasena-actualizada" ? <Alert tone="success" className="mb-4">Tu contraseña fue actualizada.</Alert> : null}
      <h1 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">Hola, {viewer.displayName ?? "corredor"}</h1>
      <p className="mt-1 text-sm text-muted">{formatDate(today, { weekday: "long", day: "numeric", month: "long", year: undefined })}</p>

      {!plan ? (
        <div className="mt-6">
          <EmptyState icon={CalendarDays} title="Todavía no tenés un plan activo" action={<ButtonLink href="/app/plan">Ver mi plan sugerido</ButtonLink>}>
            Con tu perfil completo te sugerimos un plan compatible con tu objetivo y tu disponibilidad.
          </EmptyState>
        </div>
      ) : (
        <>
          <section aria-labelledby="hoy" className="on-dark mt-6 rounded-[var(--radius-card)] bg-navy p-5 text-white sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="hoy" className="text-sm font-semibold uppercase tracking-wide text-lime">
                {next?.scheduledDate === today ? "Entrenamiento de hoy" : "Próxima sesión"}
              </h2>
              {plan.version.isDemo ? <DemoBadge /> : null}
            </div>
            {next ? (
              <>
                <p className="mt-2 text-2xl font-bold">{next.session.title}</p>
                <p className="text-sm text-white/70">
                  {SESSION_TYPE_LABELS[next.session.type]} · {formatDate(next.scheduledDate, { weekday: "long", year: undefined })}
                </p>
                <p className="mt-3 text-sm text-white/90">{next.session.objective}</p>
                <div className="mt-3 [&_li]:text-white/80"><SessionMeta item={next} /></div>
                <p className="mt-3 line-clamp-3 text-sm text-white/80"><span className="font-semibold text-white">Estructura: </span>{next.session.mainSet}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`/app/plan/sesion/${next.id}`}>Ver sesión</ButtonLink>
                  {next.scheduledDate <= today ? (
                    <ButtonLink href={`/app/registrar?sesion=${next.id}`} variant="ghost" className="border border-white/25 text-white hover:bg-white/10">Registrar</ButtonLink>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mt-2 text-white/80">No hay sesiones pendientes. ¡Completaste tu calendario!</p>
            )}
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Semana del plan" value={currentWeek ? `${currentWeek} / ${plan.version.durationWeeks}` : "—"} hint={currentWeek ? undefined : "Fuera del período del plan"} />
            <Stat
              label="Planificado esta semana"
              value={plannedDistance > 0 ? formatKm(plannedDistance) : formatDuration(plannedDuration)}
              hint={plannedDistance > 0 ? undefined : "Plan por tiempo"}
            />
            <Stat label="Realizado esta semana" value={formatKm(weekDone.distanceM)} hint={`${formatDuration(weekDone.durationS)} en ${weekDone.workouts} sesiones`} />
            <Stat label="Sesiones de la semana" value={`${weekCompleted} / ${weekPlanned}`} />
          </div>

          <Card className="mt-4">
            <CardHeader title="Progreso del plan" description={plan.raceDate ? `Competencia: ${formatDate(plan.raceDate)}` : undefined} />
            <ProgressBar value={elapsed} max={totalDays} label="Avance del plan en el tiempo" />
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-muted">
              <span>{Math.round((elapsed / totalDays) * 100)}% del calendario transcurrido</span>
              {daysToRace != null && daysToRace >= 0 ? <span>Faltan {daysToRace} días para tu competencia</span> : null}
              <span>
                Cumplimiento: {compliance?.rate != null ? `${Math.round(compliance.rate * 100)}%` : "sin sesiones vencidas"}
              </span>
            </div>
          </Card>
        </>
      )}

      <section aria-labelledby="accesos" className="mt-6">
        <h2 id="accesos" className="mb-3 text-base font-semibold text-navy">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/app/registrar", label: "Registrar entrenamiento", Icon: PlusCircle },
            { href: "/app/hidratacion", label: "Hidratación", Icon: Droplets },
            { href: "/app/progreso", label: "Evolución", Icon: LineChart },
            { href: "/app/perfil", label: "Perfil", Icon: UserRound },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 text-sm font-semibold text-navy hover:border-navy/30">
              <Icon className="size-6" aria-hidden /> {label}
            </Link>
          ))}
        </div>
      </section>
      <div className="mt-6"><MobileMoreLinks showAdmin={isStaff(viewer)} /></div>
      {recent.length === 0 && plan ? (
        <Alert className="mt-6" title="Empezá a registrar">
          <span className="inline-flex items-center gap-1"><Sparkles className="size-4" aria-hidden /> Tus estadísticas se calculan solo con tus registros reales.</span>
        </Alert>
      ) : null}
    </>
  );
}
