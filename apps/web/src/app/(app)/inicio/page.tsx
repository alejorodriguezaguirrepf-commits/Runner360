import { addDays } from "@runner360/training-engine";
import { formatDate, formatKm, formatMinutesLong, formatPercent, todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { SessionFacts, StatusBadge } from "@/components/app/session-summary";
import { IconChart, IconDrop, IconPlus, IconUser } from "@/components/ui/icons";
import { Alert, ButtonLink, Card, CardTitle, DemoBadge, EmptyState, PageHeader, ProgressBar, Stat } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";
import { buildDashboard } from "@/lib/data/dashboard";
import { loadActivePlan, loadWorkouts } from "@/lib/data/training";

export const metadata: Metadata = { title: "Inicio" };

const RECOMMENDATION_TEXT = {
  advance: { tone: "success", text: "La semana pasada cumpliste lo planificado. Seguí con la progresión del plan." },
  advance_with_caution: { tone: "info", text: "La semana pasada completaste parte de lo planificado. Seguí con el plan priorizando las sesiones clave y el descanso." },
  repeat_week: { tone: "warning", text: "La semana pasada completaste pocas sesiones. Considerá repetir esa semana antes de aumentar la carga, o consultalo con tu entrenador." },
  professional_review: { tone: "warning", text: "Reportaste dolor o un esfuerzo percibido muy alto. Te recomendamos consultar a un profesional antes de seguir progresando." },
} as const;

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  return h < 12 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireOnboardedSession();
  const today = todayIn(profile.timezone);
  const [active, workouts] = await Promise.all([loadActivePlan(supabase, user.id), loadWorkouts(supabase, user.id, addDays(today, -70))]);
  const d = buildDashboard(active, workouts, today);
  const rec = d.recommendation ? RECOMMENDATION_TEXT[d.recommendation.action] : null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${profile.display_name ?? "corredor"}`}
        subtitle={formatDate(today, "weekday")}
        actions={<ButtonLink href="/registrar"><IconPlus /> Registrar</ButtonLink>}
      />

      {!active ? (
        <Card className="mb-6">
          <EmptyState title="Todavía no tenés un plan activo" action={<ButtonLink href="/plan">Ver mi plan recomendado</ButtonLink>}>
            Elegimos el plan publicado que corresponde a tu perfil. Mientras tanto, podés registrar entrenamientos libres.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card tone="dark" className="mb-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-lime-400">Entrenamiento de hoy</h2>
              {active.version.isDemo ? <DemoBadge /> : null}
            </div>
            {d.todaySessions.length === 0 ? (
              <p className="text-white/80">
                {active.userPlan.start_date > today
                  ? `Tu plan comienza el ${formatDate(active.userPlan.start_date, "weekday")}. Hasta entonces podés registrar entrenamientos libres.`
                  : "Hoy no hay sesión planificada. Descansá o hacé actividad suave si te sentís bien."}
              </p>
            ) : (
              d.todaySessions.map((s) => (
                <div key={s.id} className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-2xl font-extrabold">{s.session.title}</p>
                    <StatusBadge status={s.status} />
                  </div>
                  {s.session.objective ? <p className="text-sm text-white/75">{s.session.objective}</p> : null}
                  <div className="rounded-xl bg-white p-4 text-ink"><SessionFacts session={s.session} /></div>
                  <div className="flex flex-wrap gap-2">
                    {s.status === "pending" ? <ButtonLink href={`/registrar?sesion=${s.id}`}>Registrar sesión</ButtonLink> : null}
                    <ButtonLink href={`/plan/sesion/${s.id}`} variant="inverse">Ver detalle</ButtonLink>
                  </div>
                </div>
              ))
            )}
          </Card>

          {rec ? <div className="mb-6"><Alert tone={rec.tone} title="Sugerencia según tu semana anterior">{rec.text}</Alert></div> : null}

          <div className="mb-6 grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>{d.planWeek ? `Semana ${d.planWeek} de ${active.version.durationWeeks}` : active.userPlan.start_date > today ? `Comienza el ${formatDate(active.userPlan.start_date)}` : "Esta semana"}</CardTitle>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Sesiones" value={`${d.week.doneSessions} / ${d.week.plannedSessions}`} />
                <Stat label="Tiempo planificado" value={formatMinutesLong(d.week.plannedDurationS)} />
                <Stat label="Distancia planificada" value={d.week.plannedDistanceM > 0 ? formatKm(d.week.plannedDistanceM) : "Por tiempo"} hint={d.week.plannedDistanceM > 0 ? undefined : "El plan indica duraciones"} />
                <Stat label="Distancia realizada" value={formatKm(d.week.doneDistanceM)} />
              </div>
            </Card>
            <Card>
              <CardTitle>Progreso del plan</CardTitle>
              <ProgressBar value={d.planProgress ?? 0} label="Progreso del plan" />
              <p className="mt-2 text-sm text-muted">{formatPercent(d.planProgress)} del calendario transcurrido</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Cumplimiento" value={formatPercent(d.compliance?.rate ?? null)} hint={d.compliance ? `${d.compliance.completed + d.compliance.modified} de ${d.compliance.due} sesiones` : undefined} />
                <Stat label="Competencia" value={d.daysToRace !== null ? `${d.daysToRace} días` : "Sin fecha"} />
              </div>
            </Card>
          </div>

          {d.nextSession ? (
            <Card className="mb-6">
              <CardTitle action={<Link href={`/plan/sesion/${d.nextSession.id}`} className="text-sm font-semibold text-navy-700 hover:underline">Ver</Link>}>Próxima sesión</CardTitle>
              <p className="text-sm text-muted">{formatDate(d.nextSession.scheduled_date, "weekday")}</p>
              <p className="mb-3 font-semibold">{d.nextSession.session.title}</p>
              <SessionFacts session={d.nextSession.session} compact />
            </Card>
          ) : null}
        </>
      )}

      <Card className="mb-6">
        <CardTitle>Últimos 30 días</CardTitle>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Distancia" value={formatKm(d.totals30d.distanceM)} />
          <Stat label="Tiempo" value={formatMinutesLong(d.totals30d.durationS)} />
          <Stat label="Entrenamientos" value={d.totals30d.workouts} />
        </div>
      </Card>

      <nav aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/registrar", label: "Entrenamiento", icon: IconPlus },
          { href: "/hidratacion", label: "Hidratación", icon: IconDrop },
          { href: "/progreso", label: "Evolución", icon: IconChart },
          { href: "/perfil", label: "Perfil", icon: IconUser },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm font-semibold hover:border-navy-700">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lime-300 text-navy-900"><Icon /></span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
