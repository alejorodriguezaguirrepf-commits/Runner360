import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryLegend } from "@/components/library/category";
import { EstimateNotice, IntensityScale, SafetyNotices } from "@/components/library/notices";
import { DayCard, WeekHeader, WeekOverview } from "@/components/library/plan-views";
import { IconCheck, IconChevronLeft, IconChevronRight, IconLock } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { requireOnboardedSession } from "@/lib/auth";
import { findPlan, getLibrary, getOverviewDays, getPlanWeeks, getWeekDays } from "@/lib/data/library";

const m = t.library;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const library = await getLibrary();
  const plan = library ? findPlan(library, id) : null;
  return { title: plan?.title ?? m.catalog.title };
}

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

  // Solo se cargan los 7 días de la semana elegida (paginado por semana).
  const [weeks, overview, days] = await Promise.all([
    getPlanWeeks(v.content_version, plan.id),
    getOverviewDays(supabase, v.content_version, plan.id),
    getWeekDays(supabase, v.content_version, plan.id, week),
  ]);
  const weekRow = weeks?.find((w) => w.week === week) ?? null;
  const weekHref = (n: number) => `/planes/${plan.id}?semana=${n}#semana`;
  const exercises = library.strength.filter((e) => e.routine === plan.strength_routine);

  return (
    <>
      <Link href="/planes" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> {m.detail.back}
      </Link>
      <PageHeader
        title={plan.title}
        subtitle={`${fmt(m.catalog.planNumber, { n: plan.number })} · ${plan.distance_label} · ${plan.level} · ${plan.duration_label} · ${fmt(m.catalog.days, { n: plan.days_per_week })}`}
        actions={<ButtonLink href={`/planes/elegir?plan=${plan.id}`}>{m.detail.start}</ButtonLink>}
      />
      <div className="mb-6 space-y-3">
        <EstimateNotice note={v.model_runner_assumptions.note} />
        <SafetyNotices items={v.safety} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{m.detail.profile}</CardTitle>
          <p className="text-sm">{plan.runner_profile}</p>
          <h3 className="mt-4 text-sm font-semibold">{m.detail.requirements}</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {plan.entry_requirements.map((r) => (
              <li key={r} className="flex gap-2"><IconCheck className="mt-0.5 shrink-0 text-success" width={16} height={16} />{r}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>{m.detail.mainGoal}</CardTitle>
          <p className="text-sm">{plan.main_goal}</p>
          {plan.secondary_goals.length ? (
            <>
              <h3 className="mt-4 text-sm font-semibold">{m.detail.secondaryGoals}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.secondary_goals.map((g) => <li key={g}>{g}</li>)}</ul>
            </>
          ) : null}
          <h3 className="mt-4 text-sm font-semibold">{m.detail.weeklyTemplate}</h3>
          <p className="mt-1 text-sm">{plan.weekly_template}</p>
          <p className="mt-3 text-sm text-muted">{fmt(m.detail.raceWeek, { n: plan.race_week })}</p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>{m.detail.phases}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">{m.detail.phaseWeeks}</th>
                <th scope="col" className="py-2 pr-3">{m.detail.phaseName}</th>
                <th scope="col" className="py-2 pr-3">{m.detail.phaseGoal}</th>
                {plan.phases.some((p) => p.km_range) ? <th scope="col" className="py-2">{m.detail.phaseKm}</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {plan.phases.map((p) => (
                <tr key={`${p.weeks}-${p.phase}`}>
                  <td className="py-2 pr-3 tabular">{p.weeks}</td>
                  <th scope="row" className="py-2 pr-3 font-semibold">{p.phase}</th>
                  <td className="py-2 pr-3">{p.goal}</td>
                  {plan.phases.some((x) => x.km_range) ? <td className="py-2 tabular">{p.km_range ?? "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 space-y-4">
        <CardTitle>{m.detail.overview}</CardTitle>
        <p className="text-xs text-muted">{m.detail.overviewHint}</p>
        <CategoryLegend legend={v.category_legend} />
        {weeks ? <WeekOverview weeks={weeks} days={overview} legend={v.category_legend} hrefForWeek={weekHref} currentWeek={week} /> : null}
      </Card>

      <Card className="mt-6 scroll-mt-6" id="semana">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold">{fmt(m.detail.weekDetail, { n: week })}</h2>
          <nav aria-label={m.detail.weekPicker} className="flex items-center gap-2">
            {week > 1 ? (
              <Link href={weekHref(week - 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold" aria-label={m.detail.prevWeek}>
                <IconChevronLeft width={16} height={16} /> {fmt(m.detail.weekShort, { n: week - 1 })}
              </Link>
            ) : null}
            <form action={`/planes/${plan.id}`} className="flex items-center gap-2">
              <label htmlFor="semana-select" className="sr-only">{m.detail.weekPicker}</label>
              <select id="semana-select" name="semana" defaultValue={week} className="min-h-11 rounded-xl border border-line bg-surface px-2 text-sm">
                {Array.from({ length: plan.duration_weeks }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{fmt(m.detail.weekShort, { n })}</option>
                ))}
              </select>
              <button type="submit" className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">{m.detail.go}</button>
            </form>
            {week < plan.duration_weeks ? (
              <Link href={weekHref(week + 1)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold" aria-label={m.detail.nextWeek}>
                {fmt(m.detail.weekShort, { n: week + 1 })} <IconChevronRight width={16} height={16} />
              </Link>
            ) : null}
          </nav>
        </div>
        {weekRow ? <WeekHeader week={weekRow} /> : null}
        {days.length === 7 ? (
          <div className="mt-4 grid gap-3">
            {days.map((d) => <DayCard key={d.day_index} day={d} legend={v.category_legend} />)}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-line bg-canvas p-5">
            <p className="inline-flex items-center gap-2 font-semibold"><IconLock /> {m.detail.locked}</p>
            <p className="text-sm text-muted">{m.detail.lockedText}</p>
            <ButtonLink href="/suscripcion" variant="secondary">{m.detail.seePremium}</ButtonLink>
          </div>
        )}
      </Card>

      <div className="mt-6 space-y-3">
        <IntensityScale items={library.intensities} />
        <details className="rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{m.detail.strength} · {fmt(m.detail.strengthRoutine, { r: plan.strength_routine })}</summary>
          <ul className="mt-2 divide-y divide-line">
            {exercises.map((e) => (
              <li key={e.position} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-semibold">{e.exercise}</span>
                <span className="text-muted">{e.target} · {e.sets_reps}</span>
              </li>
            ))}
          </ul>
        </details>
        {plan.notes.length ? (
          <details className="rounded-xl border border-line bg-surface p-3 text-sm">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">{m.detail.notes}</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">{plan.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </details>
        ) : null}
        <details className="rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">{m.detail.validation}</summary>
          <ul className="mt-2 divide-y divide-line">
            {plan.validation.map((c) => (
              <li key={c.check} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr_auto]">
                <span className="font-semibold">{c.check}</span>
                <span>{c.result}</span>
                <Badge tone={c.ok ? "success" : "danger"}>{c.ok ? m.detail.validationOk : m.detail.validationFail}</Badge>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}
