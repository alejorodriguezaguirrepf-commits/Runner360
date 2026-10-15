import { addDays, formatKmValue, formatMinutes, mondayOf, planDayAt, type Category } from "@runner360/plan-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { IconChevronRight } from "@/components/ui/icons";
import { ButtonLink, Card, CardTitle, ProgressBar } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { OpenEnrollment } from "@/lib/data/enrollment";
import type { DayRow } from "@/lib/data/library";
import { loadWeek, todaySummary } from "@/lib/library/week";

const D = t.dashboard;
const W = t.library.workout;

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
const category = (d: DayRow): Category => (d.is_rest ? "rest" : (d.category ?? "rest"));

/** Métrica grande y legible (valor con cifras tabulares + etiqueta). */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-nav-muted">{label}</p>
      <p className="tabular truncate text-2xl font-extrabold leading-tight text-nav-ink sm:text-[28px]">{value}</p>
    </div>
  );
}

/**
 * Inicio con un plan de la biblioteca: entrenamiento de hoy (métricas y acción), progreso de la
 * semana y próxima sesión. Solo datos reales del plan y de los registros.
 */
export async function PlanDashboard({ open, supabase, today }: { open: OpenEnrollment; supabase: SupabaseClient; today: string }) {
  const { enrollment, plan } = open;
  const monday = mondayOf(today);
  const week = enrollment.status === "active" ? await loadWeek(supabase, open, monday) : null;
  const slot = planDayAt(enrollment, open.segments, plan.duration_weeks, today);
  const todayDay = slot && week ? (week.days.find((d) => d.day_index === slot.dayIndex) ?? null) : null;

  const sessions = (week?.dated ?? []).filter((x) => !x.day.is_rest);
  const doneDates = new Set((week?.logs ?? []).filter((l) => l.status !== "skipped").map((l) => l.workout_date));
  const done = sessions.filter((x) => doneDates.has(x.date));
  const plannedMin = sessions.reduce((a, x) => a + (x.day.duration_min_est ?? 0), 0);
  const doneMin = done.reduce((a, x) => a + (x.day.duration_min_est ?? 0), 0);
  const todayN = sessions.findIndex((x) => x.date === today) + 1;

  // Próxima sesión: más adelante en esta semana o, si no hay, la primera de la semana siguiente.
  let next = sessions.find((x) => x.date > today) ?? null;
  let nextN = next ? sessions.indexOf(next) + 1 : 0;
  if (!next && week) {
    const following = await loadWeek(supabase, open, addDays(monday, 7));
    const s = (following?.dated ?? []).filter((x) => !x.day.is_rest);
    next = s[0] ?? null;
    nextN = next ? 1 : 0;
  }

  const fallback = todayDay ? null : await todaySummary(supabase, open, today);
  const isSession = todayDay && !todayDay.is_rest;

  return (
    <>
      <Card tone="dark" className="mb-6 p-6">
        <p className="text-sm font-semibold text-accent">{D.today}</p>
        {isSession ? (
          <>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight sm:text-[28px]">{todayDay.session_type}</h2>
            <p className="mt-1 text-nav-muted">{fmt(D.dayOfWeek, { n: todayN, w: slot!.planWeek, total: plan.duration_weeks })}</p>
            <div className="mt-5 grid grid-cols-3 gap-4">
              <Metric label={D.duration} value={formatMinutes(todayDay.duration_min_est)} />
              <Metric label={D.distance} value={todayDay.distance_km_est ? formatKmValue(todayDay.distance_km_est, { oneDecimal: true }) : "—"} />
              <Metric label={D.intensity} value={W.category[category(todayDay)]} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink href="/hoy">{D.viewWorkout}</ButtonLink>
              <ButtonLink href="/plan" variant="inverse">{t.library.nav.myPlan}</ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight">{todayDay ? D.restTitle : plan.title}</h2>
            <p className="mt-1 text-nav-muted">{todayDay ? D.restText : fallback}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <ButtonLink href="/plan">{t.library.nav.myPlan}</ButtonLink>
            </div>
          </>
        )}
      </Card>

      {week ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>{fmt(W.weekOf, { n: week.planWeek, total: plan.duration_weeks })}</CardTitle>
            <p className="tabular text-[28px] font-extrabold leading-tight">
              {done.length}
              <span className="text-lg font-semibold text-muted"> / {fmt(sessions.length === 1 ? D.sessionsOne : D.sessions, { n: sessions.length })}</span>
            </p>
            <div className="mt-3">
              <ProgressBar value={sessions.length ? done.length / sessions.length : 0} label={D.weekProgress} />
            </div>
            <p className="tabular mt-2 text-sm text-muted">{fmt(D.minutes, { done: formatMinutes(doneMin, { round: true }), total: formatMinutes(plannedMin, { round: true }) })}</p>
          </Card>
          <Card>
            <CardTitle>{D.next}</CardTitle>
            {next ? (
              <Link href="/plan" className="group flex items-center gap-4 rounded-xl border border-line p-3 hover:border-primary">
                <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-2 leading-none">
                  <span className="text-xs font-bold uppercase text-muted">{W.day}</span>
                  <span className="tabular text-lg font-extrabold">{nextN}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{next.day.session_type}</span>
                  <span className="tabular block text-sm text-muted">
                    {shortDate(next.date)} · {formatMinutes(next.day.duration_min_est)}
                    {next.day.distance_km_est ? ` · ${formatKmValue(next.day.distance_km_est, { oneDecimal: true })}` : ""}
                  </span>
                </span>
                <IconChevronRight className="shrink-0 text-muted group-hover:text-primary-ink" />
              </Link>
            ) : (
              <p className="text-sm text-muted">{D.noNext}</p>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
