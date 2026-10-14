import { addDays, DAY_LABELS, formatClock, mondayOf, planDayAt, ruleText, weekdayOf } from "@runner360/plan-library";
import { formatDate, todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import { CheckinCard } from "@/components/library/checkin-card";
import { IntensityScale, SafetyNotices } from "@/components/library/notices";
import { WorkoutDay } from "@/components/library/workout";
import { SessionLogForm, type LogDefaults } from "@/components/library/session-log-form";
import { IconLock } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, cx, EmptyState, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { resumePlanAction } from "@/lib/actions/plan-progress";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { checkinProps, loadWeek, pendingCheckinWeek, resumeTarget } from "@/lib/library/week";

export const metadata: Metadata = { title: "Hoy" };

const T = t.library.today;

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ checkin?: string; pausa?: string }> }) {
  const { checkin: checkinDone, pausa } = await searchParams;
  const { supabase, user, profile } = await requireOnboardedSession();
  const today = todayIn(profile.timezone);
  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) {
    return (
      <>
        <PageHeader title={T.title} subtitle={formatDate(today, "weekday")} />
        <Card>
          <EmptyState title={T.noPlan} action={<ButtonLink href="/planes">{t.library.catalog.choose}</ButtonLink>} />
        </Card>
      </>
    );
  }
  const { enrollment, plan, library } = open;
  const v = library.version;
  const header = <PageHeader title={T.title} subtitle={`${formatDate(today, "weekday")} · ${plan.title}`} actions={<ButtonLink href="/plan" variant="ghost">{t.library.nav.myPlan}</ButtonLink>} />;
  const notices = (
    <div className="mb-6 space-y-3">
      <SafetyNotices items={v.safety} />
    </div>
  );

  if (enrollment.status === "paused") {
    const target = await resumeTarget(supabase, open, today);
    const stopText = ruleText({ kind: "load_monitoring", signal: "Dolor (0–10)", field: "stop_and_consult" }, v);
    return (
      <>
        {header}
        <Card className="mb-6 space-y-3">
          {pausa ? (
            <Alert tone="danger" title={t.library.log.stop}>
              {stopText}
            </Alert>
          ) : null}
          <Alert tone="danger" title={T.paused}>{T.pausedText}</Alert>
          <SafetyNotices items={v.safety} defaultOpen />
          <p className="text-sm text-muted">{fmt(T.resumeText, { n: target })}</p>
          <form action={resumePlanAction}>
            <button type="submit" className="min-h-11 rounded-xl bg-lime-400 px-4 text-sm font-semibold text-navy-950">{T.resume}</button>
          </form>
        </Card>
      </>
    );
  }

  const slot = planDayAt(enrollment, open.segments, plan.duration_weeks, today);
  const week = await loadWeek(supabase, open, mondayOf(today));
  const todayDay = slot && week ? week.days.find((d) => d.day_index === slot.dayIndex) : null;
  const todayLog = week?.logs.find((l) => l.workout_date === today) ?? null;
  const pending = pendingCheckinWeek(open, today, weekdayOf(today));
  const checkin = pending ? await checkinProps(supabase, open, pending, today) : null;
  const { data: consent } = await supabase.rpc("has_consent", { p_user: user.id, p_type: "health_data" });

  // ¿Quedó sin registrar la sesión de ayer? (no se recupera: solo se informa).
  const yesterday = addDays(today, -1);
  const yesterdayPlanned = week?.dated.find((x) => x.date === yesterday && !x.day.is_rest);
  const missedYesterday = yesterdayPlanned && !week?.logs.some((l) => l.workout_date === yesterday);
  const missedRule = v.practical_rules.find((r) => r.startsWith("Sesión perdida"));

  const defaults: LogDefaults = {
    status: todayLog?.status ?? "completed",
    duration: todayLog?.duration_s ? formatClock(todayLog.duration_s) : "",
    distanceKm: todayLog?.distance_m ? String(todayLog.distance_m / 1000).replace(".", ",") : "",
    rpe: todayLog?.rpe ? String(todayLog.rpe) : "",
    pain: todayLog?.pain_score !== null && todayLog?.pain_score !== undefined ? String(todayLog.pain_score) : "",
    redFlags: todayLog?.red_flags ?? [],
    sleep: todayLog?.sleep_quality ?? "",
    notes: todayLog?.comments ?? "",
  };

  let main: React.ReactNode;
  if (!slot) {
    main = (
      <Card className="mb-6">
        <p className="font-semibold">
          {today < enrollment.start_date ? fmt(T.notStarted, { date: formatDate(enrollment.start_date, "long") }) : T.finished}
        </p>
      </Card>
    );
  } else if (!todayDay) {
    main = (
      <Card className="mb-6">
        <p className="inline-flex items-center gap-2 font-semibold"><IconLock /> {T.locked}</p>
        <div className="mt-3"><ButtonLink href="/suscripcion" variant="secondary">{t.library.detail.seePremium}</ButtonLink></div>
      </Card>
    );
  } else {
    main = (
      <div className="mb-6 space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">{fmt(T.sessionOf, { n: slot.planWeek })}</p>
        <ol>
          <WorkoutDay day={todayDay} n={(week?.dated.findIndex((x) => x.date === today) ?? 0) + 1} legend={v.category_legend} today open tips />
        </ol>
        <IntensityScale items={library.intensities} />
        {todayDay.is_rest ? (
          <Card>
            <p className="font-semibold">{todayDay.strength_only ? fmt(T.strengthOnly, { r: plan.strength_routine }) : T.rest}</p>
          </Card>
        ) : (
          <Card>
            <CardTitle>{todayLog ? T.loggedTitle : T.logTitle}</CardTitle>
            <SessionLogForm date={today} defaults={defaults} hasHealthConsent={consent === true} />
          </Card>
        )}
      </div>
    );
  }

  return (
    <>
      {header}
      {checkinDone ? <div className="mb-4"><Alert tone="success">{checkinDone === "fin" ? t.library.checkin.completed : t.library.checkin.saved}</Alert></div> : null}
      {notices}
      {missedYesterday && missedRule ? (
        <div className="mb-6"><Alert tone="info" title={T.missedYesterday}>{missedRule}</Alert></div>
      ) : null}
      {checkin ? (
        <div className="mb-6">
          <CheckinCard
            weekStart={checkin.weekStart}
            title={fmt(t.library.checkin.weekOf, { n: checkin.planWeek, from: formatDate(checkin.weekStart), to: formatDate(addDays(checkin.weekStart, 6)) })}
            criterion={checkin.criterion}
            ifYes={checkin.ifYes}
            ifNo={checkin.ifNo}
            returnTo="/hoy"
          />
        </div>
      ) : null}
      {main}
      {week ? (
        <Card>
          <CardTitle>{T.week}</CardTitle>
          <ol className="grid grid-cols-7 gap-1 text-center text-xs">
            {week.dated.map(({ day, date }) => {
              const log = week.logs.find((l) => l.workout_date === date);
              const status = day.is_rest ? T.restShort : log ? (log.status === "skipped" ? T.skipped : T.logged) : date < today ? T.missed : T.planned;
              return (
                <li key={date} className={cx("rounded-lg border p-1.5", date === today ? "border-lime-500 bg-lime-300/40" : "border-line")}>
                  <p className="font-semibold">{DAY_LABELS[weekdayOf(date)]}</p>
                  <p className="text-muted">{date.slice(8)}</p>
                  <p className="mt-1 truncate font-semibold">{day.is_rest ? "—" : day.short_label}</p>
                  <Badge tone={log && log.status !== "skipped" ? "success" : !day.is_rest && date < today ? "warning" : "neutral"} className="mt-1 max-w-full truncate px-1 text-[10px]">{status}</Badge>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}
    </>
  );
}
