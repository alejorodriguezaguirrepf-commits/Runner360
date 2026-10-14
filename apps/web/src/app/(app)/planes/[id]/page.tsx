import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafetyNotices } from "@/components/library/notices";
import { WeekStrip, weekSummary, WorkoutDay } from "@/components/library/workout";
import { IconChevronLeft, IconLock } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { requireOnboardedSession } from "@/lib/auth";
import { findPlan, getLibrary, getOverviewDays, getWeekDays } from "@/lib/data/library";

const m = t.library;
const w = m.workout;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const library = await getLibrary();
  const plan = library ? findPlan(library, id) : null;
  return { title: plan?.title ?? m.catalog.title };
}

/** Plan como lista de tareas: semana elegida (tira S1…SN) y sus días numerados, sin explicaciones. */
export default async function PlanDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ semana?: string }> }) {
  const { supabase } = await requireOnboardedSession();
  const { id } = await params;
  const library = await getLibrary();
  if (!library) {
    return (
      <>
        <PageHeader title={m.catalog.title} />
        <Alert tone="info" title={m.unavailable.title}>{m.unavailable.text}</Alert>
      </>
    );
  }
  const plan = findPlan(library, id);
  if (!plan) notFound();
  const v = library.version;

  const { semana } = await searchParams;
  const requestedWeek = Number(semana);
  const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= plan.duration_weeks ? requestedWeek : 1;

  // Semanas con acceso (las que trae la base: muestra gratis o meses liberados) y la semana elegida.
  const [overview, days] = await Promise.all([
    getOverviewDays(supabase, v.content_version, plan.id),
    getWeekDays(supabase, v.content_version, plan.id, week),
  ]);
  const openWeeks = new Set(overview.map((d) => d.week));
  const weekHref = (n: number) => `/planes/${plan.id}?semana=${n}`;
  const exercises = library.strength.filter((e) => e.routine === plan.strength_routine);
  const firstSession = days.find((d) => !d.is_rest)?.day_index;

  return (
    <>
      <Link href="/planes" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> {m.detail.back}
      </Link>
      <PageHeader title={plan.title} actions={<ButtonLink href={`/planes?plan=${plan.id}#empezar`}>{m.detail.start}</ButtonLink>} />
      <div className="-mt-3 mb-5 flex flex-wrap gap-1.5">
        <Badge>{plan.distance_label}</Badge>
        <Badge>{plan.level}</Badge>
        <Badge>{plan.duration_label}</Badge>
        <Badge>{fmt(m.catalog.days, { n: plan.days_per_week })}</Badge>
      </div>

      <section aria-labelledby="semana" className="space-y-4">
        <WeekStrip
          pills={Array.from({ length: plan.duration_weeks }, (_, i) => i + 1).map((n) => ({
            key: String(n),
            label: fmt(w.week, { n }),
            href: weekHref(n),
            locked: !openWeeks.has(n),
            selected: n === week,
            current: false,
          }))}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="semana" className="text-2xl font-extrabold">{fmt(w.weekOf, { n: week, total: plan.duration_weeks })}</h2>
          {days.length === 7 ? <p className="text-sm font-semibold text-muted">{weekSummary(days)}</p> : null}
        </div>
        {days.length === 7 ? (
          <ol className="space-y-2.5">
            {days
              .filter((d) => !d.is_rest)
              .map((d, i) => (
                <WorkoutDay key={d.day_index} day={d} n={i + 1} legend={v.category_legend} open={d.day_index === firstSession} />
              ))}
          </ol>
        ) : (
          <Card className="flex flex-col items-start gap-3">
            <p className="inline-flex items-center gap-2 font-semibold"><IconLock /> {m.detail.locked}</p>
            <p className="text-sm text-muted">{m.detail.lockedText}</p>
            <ButtonLink href="/suscripcion" variant="secondary">{m.detail.seePremium}</ButtonLink>
          </Card>
        )}
      </section>

      <div className="mt-6 space-y-3">
        <details className="rounded-2xl border border-line bg-surface p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{fmt(w.strengthRoutine, { r: plan.strength_routine })}</summary>
          <ul className="mt-2 divide-y divide-line">
            {exercises.map((e) => (
              <li key={e.position} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{e.exercise}</span>
                <span className="text-muted">{e.sets_reps}</span>
              </li>
            ))}
          </ul>
        </details>
        <SafetyNotices items={v.safety} />
      </div>
    </>
  );
}
