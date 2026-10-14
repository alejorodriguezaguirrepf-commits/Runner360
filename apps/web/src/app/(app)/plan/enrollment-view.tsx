import {
  addDays,
  formatClock,
  formatKmValue,
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
import { SafetyNotices } from "@/components/library/notices";
import { WeekStrip, weekSummary, WorkoutDay } from "@/components/library/workout";
import { IconLock } from "@/components/ui/icons";
import { Alert, ButtonLink, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { OpenEnrollment } from "@/lib/data/enrollment";
import { getOverviewDays } from "@/lib/data/library";
import { checkinProps, loadWeek, pendingCheckinWeek } from "@/lib/library/week";
import { CheckinCard } from "@/components/library/checkin-card";
import { CancelEnrollmentButton } from "./plan-actions";

const m = t.library;
const c = m.calendar;
const w = m.workout;

/** "19 oct": fecha sin el nombre del día (los días se nombran por número). */
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

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
  const [week, overview] = await Promise.all([
    loadWeek(supabase, open, selected),
    getOverviewDays(supabase, enrollment.content_version, plan.id),
  ]);
  const openWeeks = new Set(overview.map((d) => d.week));
  const ordered = week?.dated ?? [];
  const doneDates = new Set((week?.logs ?? []).filter((l) => l.status !== "skipped").map((l) => l.workout_date));

  const pending = enrollment.status === "active" ? pendingCheckinWeek(open, today, weekdayOf(today)) : null;
  const checkin = pending ? await checkinProps(supabase, open, pending, today) : null;
  const projected = projectedRaceDate(segments, plan.duration_weeks, plan.race_week);
  const mark =
    enrollment.mark_distance_m && enrollment.mark_time_s && enrollment.mark_date
      ? { distanceKm: enrollment.mark_distance_m / 1000, timeS: enrollment.mark_time_s, date: enrollment.mark_date }
      : null;
  const paces = mark ? referencePaces(mark, today) : null;
  const weekHref = (ws: string) => `/plan?semana=${ws}`;
  const firstOpen = ordered.find((o) => o.date === today && !o.day.is_rest) ?? ordered.find((o) => !o.day.is_rest && o.date >= today) ?? ordered.find((o) => !o.day.is_rest);

  const status =
    enrollment.status === "paused" || currentPlanWeek === null
      ? c.paused
      : typeof currentPlanWeek === "number"
        ? fmt(c.weekOf, { n: currentPlanWeek, total: plan.duration_weeks })
        : today < enrollment.start_date
          ? fmt(c.notStarted, { date: shortDate(enrollment.start_date) })
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
      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted">{c.currentWeek}</dt><dd className="text-lg font-bold">{status}</dd></div>
          <div><dt className="text-muted">{c.race}</dt><dd className="text-lg font-bold">{shortDate(enrollment.race_date)}</dd></div>
        </dl>
        {projected && projected !== enrollment.race_date ? <p className="mt-3 text-sm text-warning">{fmt(c.projectedRace, { date: formatDate(projected, "long") })}</p> : null}
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

      <section aria-labelledby="semana" className="mb-6 space-y-4">
        <WeekStrip
          pills={weeks.map((x) => ({
            key: x.weekStart,
            label: typeof x.planWeek === "number" ? fmt(w.week, { n: x.planWeek }) : c.pausedWeek,
            href: weekHref(x.weekStart),
            locked: typeof x.planWeek === "number" && !openWeeks.has(x.planWeek),
            selected: x.weekStart === selected,
            current: x.weekStart === thisMonday,
          }))}
        />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="semana" className="text-2xl font-extrabold">
              {typeof selectedPlanWeek === "number" ? fmt(w.weekOf, { n: selectedPlanWeek, total: plan.duration_weeks }) : c.pausedWeek}
            </h2>
            <p className="text-sm text-muted">{shortDate(selected)} – {shortDate(addDays(selected, 6))}</p>
          </div>
          {ordered.length === 7 ? <p className="text-sm font-semibold text-muted">{weekSummary(ordered.map((o) => o.day))}</p> : null}
        </div>
        {typeof selectedPlanWeek === "number" ? (
          ordered.length === 7 ? (
            <ol className="space-y-2.5">
              {ordered.map(({ day, date }, i) => (
                <WorkoutDay
                  key={day.day_index}
                  day={day}
                  n={i + 1}
                  legend={v.category_legend}
                  today={date === today}
                  done={doneDates.has(date)}
                  open={firstOpen?.date === date}
                  dateHint={shortDate(date)}
                />
              ))}
            </ol>
          ) : (
            <Card className="flex flex-col items-start gap-3">
              <p className="inline-flex items-center gap-2 font-semibold"><IconLock /> {m.detail.locked}</p>
              <p className="text-sm text-muted">{m.detail.lockedText}</p>
              <ButtonLink href="/suscripcion" variant="secondary">{m.detail.seePremium}</ButtonLink>
            </Card>
          )
        ) : null}
      </section>

      <SafetyNotices items={v.safety} />
    </>
  );
}
