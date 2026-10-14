import {
  addDays,
  DAY_LABELS,
  formatClock,
  formatKmValue,
  formatMinutes,
  formatPace,
  mondayOf,
  planWeekAt,
  projectedRaceDate,
  referencePaces,
  scheduledWeeks,
  weekdayOf,
} from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { DayCard, WeekHeader } from "@/components/library/plan-views";
import { EstimateNotice, IntensityScale, SafetyNotices } from "@/components/library/notices";
import { IconChevronLeft, IconChevronRight, IconLock } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { OpenEnrollment } from "@/lib/data/enrollment";
import { getPlanWeeks, getWeekDays } from "@/lib/data/library";
import { checkinProps, pendingCheckinWeek } from "@/lib/library/week";
import { CheckinCard } from "@/components/library/checkin-card";
import { CancelEnrollmentButton } from "./plan-actions";

const m = t.library;
const c = m.calendar;

export async function EnrollmentView({
  open,
  supabase,
  today,
  requestedWeek,
  enrolled,
  checkinDone,
}: {
  checkinDone?: string;
  open: OpenEnrollment;
  supabase: SupabaseClient;
  today: string;
  requestedWeek?: string;
  enrolled: boolean;
}) {
  const { enrollment, plan, library, segments } = open;
  const v = library.version;
  const weeks = scheduledWeeks(segments, plan.duration_weeks);
  const thisMonday = mondayOf(today);
  const currentPlanWeek = planWeekAt(segments, thisMonday, plan.duration_weeks);

  // Semana elegida: la pedida (si es un lunes del calendario), la actual, o la primera/última.
  const valid = (w?: string) => (w && /^\d{4}-\d{2}-\d{2}$/.test(w) && weekdayOf(w) === 0 ? w : undefined);
  const selected =
    valid(requestedWeek) ??
    (weeks.some((w) => w.weekStart === thisMonday) ? thisMonday : thisMonday < enrollment.start_date ? enrollment.start_date : (weeks.at(-1)?.weekStart ?? enrollment.start_date));
  const selectedPlanWeek = planWeekAt(segments, selected, plan.duration_weeks);
  const [planWeeks, days] = await Promise.all([
    getPlanWeeks(enrollment.content_version, plan.id),
    typeof selectedPlanWeek === "number" ? getWeekDays(supabase, enrollment.content_version, plan.id, selectedPlanWeek) : Promise.resolve([]),
  ]);
  const weekRow = planWeeks?.find((w) => w.week === selectedPlanWeek) ?? null;
  const ordered = days
    .map((d) => ({ d, date: addDays(selected, enrollment.day_map[d.day_index]!) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pending = enrollment.status === "active" ? pendingCheckinWeek(open, today, weekdayOf(today)) : null;
  const checkin = pending ? await checkinProps(supabase, open, pending, today) : null;
  const projected = projectedRaceDate(segments, plan.duration_weeks, plan.race_week);
  const mark =
    enrollment.mark_distance_m && enrollment.mark_time_s && enrollment.mark_date
      ? { distanceKm: enrollment.mark_distance_m / 1000, timeS: enrollment.mark_time_s, date: enrollment.mark_date }
      : null;
  const paces = mark ? referencePaces(mark, today) : null;
  const weekHref = (w: string) => `/plan?semana=${w}#semana`;
  const idx = weeks.findIndex((w) => w.weekStart === selected);
  const prev = idx > 0 ? weeks[idx - 1] : undefined;
  const next = idx >= 0 && idx < weeks.length - 1 ? weeks[idx + 1] : undefined;

  const status =
    enrollment.status === "paused" || currentPlanWeek === null
      ? c.paused
      : typeof currentPlanWeek === "number"
        ? fmt(c.weekOf, { n: currentPlanWeek, total: plan.duration_weeks })
        : today < enrollment.start_date
          ? fmt(c.notStarted, { date: formatDate(enrollment.start_date, "long") })
          : c.finished;

  return (
    <>
      <PageHeader
        title={plan.title}
        subtitle={`${plan.distance_label} · ${plan.level} · ${plan.duration_label} · ${fmt(m.catalog.days, { n: plan.days_per_week })}`}
        actions={
          <>
            <ButtonLink href="/plan/dias" variant="ghost">{c.moveDays}</ButtonLink>
            <CancelEnrollmentButton />
          </>
        }
      />
      {enrolled ? <div className="mb-4"><Alert tone="success" title={c.enrolled} /></div> : null}
      {checkinDone ? <div className="mb-4"><Alert tone="success">{checkinDone === "fin" ? m.checkin.completed : m.checkin.saved}</Alert></div> : null}
      {enrollment.status === "paused" ? (
        <div className="mb-4">
          <Alert tone="danger" title={m.today.paused}>
            {m.today.pausedText} <Link href="/hoy" className="font-semibold underline">{m.today.resume}</Link>
          </Alert>
        </div>
      ) : null}
      {checkin ? (
        <div className="mb-6">
          <CheckinCard
            weekStart={checkin.weekStart}
            title={fmt(m.checkin.weekOf, { n: checkin.planWeek, from: formatDate(checkin.weekStart), to: formatDate(addDays(checkin.weekStart, 6)) })}
            criterion={checkin.criterion}
            ifYes={checkin.ifYes}
            ifNo={checkin.ifNo}
            returnTo="/plan"
          />
        </div>
      ) : null}
      <div className="mb-6 space-y-3">
        <EstimateNotice note={v.model_runner_assumptions.note} />
        <SafetyNotices items={v.safety} />
      </div>

      <Card className="mb-6">
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div><dt className="text-muted">{c.currentWeek}</dt><dd className="text-lg font-bold">{status}</dd></div>
          <div><dt className="text-muted">{c.start}</dt><dd className="text-lg font-bold">{formatDate(enrollment.start_date)}</dd></div>
          <div><dt className="text-muted">{c.race}</dt><dd className="text-lg font-bold">{formatDate(enrollment.race_date)}</dd></div>
          <div>
            <dt className="text-muted">{c.days}</dt>
            <dd className="text-lg font-bold">
              {ordered.length
                ? ordered.filter((o) => !o.d.is_rest).map((o) => DAY_LABELS[weekdayOf(o.date)]).join(" · ")
                : "—"}
            </dd>
          </div>
        </dl>
        {projected && projected !== enrollment.race_date ? <p className="mt-3 text-sm text-warning">{fmt(c.projectedRace, { date: formatDate(projected, "long") })}</p> : null}
        <p className="mt-3 text-xs text-muted">{fmt(c.contentVersion, { v: enrollment.content_version })}</p>
      </Card>

      {mark ? (
        <Card className="mb-6">
          <CardTitle>{m.paces.title}</CardTitle>
          {paces ? (
            <>
              <p className="mb-3 text-sm text-muted">
                {fmt(m.paces.text, { date: formatDate(mark.date, "long"), km: formatKmValue(mark.distanceKm), time: formatClock(mark.timeS) })}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-left text-sm">
                  <thead className="text-muted">
                    <tr>
                      <th scope="col" className="py-1.5 pr-3">{m.paces.distance}</th>
                      <th scope="col" className="py-1.5 pr-3">{m.paces.time}</th>
                      <th scope="col" className="py-1.5">{m.paces.pace}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular">
                    {paces.map((p) => (
                      <tr key={p.distanceKm}>
                        <th scope="row" className="py-1.5 pr-3 font-semibold">{formatKmValue(p.distanceKm, { oneDecimal: p.distanceKm > 20 })}</th>
                        <td className="py-1.5 pr-3">{formatClock(p.timeS)}</td>
                        <td className="py-1.5">
                          {formatPace(p.paceSPerKm)}
                          {p.marathonFastLimit ? <span className="block text-xs text-warning">{m.paces.marathon}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{m.paces.old}</p>
          )}
        </Card>
      ) : null}

      <Card id="semana" className="mb-6 scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">{fmt(c.weekTitle, { from: formatDate(selected), to: formatDate(addDays(selected, 6)) })}</h2>
            <p className="text-sm text-muted">
              {typeof selectedPlanWeek === "number" ? fmt(c.planWeek, { n: selectedPlanWeek }) : selectedPlanWeek === null ? c.pausedWeek : "—"}
            </p>
          </div>
          <nav aria-label={m.detail.weekPicker} className="flex gap-2">
            {prev ? (
              <Link href={weekHref(prev.weekStart)} aria-label={c.prev} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold">
                <IconChevronLeft width={16} height={16} />
              </Link>
            ) : null}
            {selected !== thisMonday && weeks.some((w) => w.weekStart === thisMonday) ? (
              <Link href={weekHref(thisMonday)} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold">{c.today}</Link>
            ) : null}
            {next ? (
              <Link href={weekHref(next.weekStart)} aria-label={c.next} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold">
                <IconChevronRight width={16} height={16} />
              </Link>
            ) : null}
          </nav>
        </div>
        {weekRow ? <WeekHeader week={weekRow} /> : null}
        {typeof selectedPlanWeek === "number" ? (
          ordered.length === 7 ? (
            <div className="mt-4 grid gap-3">
              {ordered.map(({ d, date }) => (
                <div key={d.day_index} className={date === today ? "rounded-xl ring-2 ring-lime-400" : undefined}>
                  <DayCard day={d} legend={v.category_legend} dateLabel={`${date === today ? `${c.today} · ` : ""}${formatDate(date)}`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-line bg-canvas p-5">
              <p className="inline-flex items-center gap-2 font-semibold"><IconLock /> {m.detail.locked}</p>
              <p className="text-sm text-muted">{m.detail.lockedText}</p>
              <ButtonLink href="/suscripcion" variant="secondary">{m.detail.seePremium}</ButtonLink>
            </div>
          )
        ) : null}
      </Card>

      <details className="mb-6 rounded-xl border border-line bg-surface p-3 text-sm">
        <summary className="min-h-11 cursor-pointer content-center font-semibold">{c.upcoming}</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {weeks.map((w) => {
            const row = typeof w.planWeek === "number" ? planWeeks?.find((x) => x.week === w.planWeek) : null;
            return (
              <li key={w.weekStart}>
                <Link href={weekHref(w.weekStart)} className="flex justify-between gap-3 rounded-lg bg-canvas px-3 py-1.5 hover:bg-navy-100">
                  <span>
                    <span className="font-semibold">{formatDate(w.weekStart)}</span> ·{" "}
                    {typeof w.planWeek === "number" ? fmt(m.detail.weekShort, { n: w.planWeek }) : c.pausedWeek}
                    {w.weekStart === thisMonday ? <Badge tone="lime" className="ml-2">{c.today}</Badge> : null}
                  </span>
                  <span className="tabular text-muted">{row ? `${formatKmValue(row.distance_km_est, { oneDecimal: true })} · ${formatMinutes(row.duration_min_est, { round: true })}` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </details>

      <div className="space-y-3">
        <IntensityScale items={library.intensities} />
        <Link href={`/planes/${plan.id}`} className="inline-block text-sm font-semibold underline">{m.catalog.viewPlan}</Link>
      </div>
    </>
  );
}
