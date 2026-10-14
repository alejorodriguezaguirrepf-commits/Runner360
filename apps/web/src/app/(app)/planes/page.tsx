import { catalogSteps, LEVELS, raceDateFromStart, type CatalogFilter, type Level } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { EstimateNotice, SafetyNotices } from "@/components/library/notices";
import { IconCheck, IconChevronRight } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, CardTitle, cx, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { hasPremium, requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { findPlan, getLibrary } from "@/lib/data/library";
import { startMondays } from "@/lib/library/start";
import { EnrollForm } from "./enroll-form";

export const metadata: Metadata = { title: "Planes de entrenamiento" };

const m = t.library;

type Search = { d?: string; dias?: string; s?: string; n?: string; plan?: string };

/** Distancia objetivo del perfil de corredor → pestaña inicial. */
const PROFILE_DISTANCE: Record<string, number> = { "5K": 5, "10K": 10, "21K": 21.0975, "42K": 42.195 };

function parseFilter(sp: Search): CatalogFilter {
  const num = (v?: string) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
  return {
    distanceKm: num(sp.d),
    daysPerWeek: num(sp.dias),
    durationWeeks: num(sp.s),
    level: LEVELS.includes(sp.n as Level) ? (sp.n as Level) : undefined,
  };
}

/** URL del selector; cambiar un paso borra los posteriores. */
function href(f: CatalogFilter): string {
  const q = new URLSearchParams();
  if (f.distanceKm !== undefined) q.set("d", String(f.distanceKm));
  if (f.daysPerWeek !== undefined) q.set("dias", String(f.daysPerWeek));
  if (f.durationWeeks !== undefined) q.set("s", String(f.durationWeeks));
  if (f.level) q.set("n", f.level);
  const s = q.toString();
  return s ? `/planes?${s}` : "/planes";
}

const tabLabel = (km: number) => `${Math.floor(km)} km`;

function Step<T extends string | number>({ title, options, selected, label, link }: { title: string; options: T[]; selected: T | undefined; label: (v: T) => string; link: (v: T) => string }) {
  if (options.length === 0) return null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">{title}</legend>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o === selected;
          return (
            <li key={String(o)}>
              <Link
                href={link(o)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
                  active ? "border-lime-400 bg-lime-400 text-navy-950" : "border-line bg-surface text-ink hover:border-lime-400",
                )}
              >
                {label(o)}
              </Link>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export default async function PlansPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const library = await getLibrary();
  if (!library) {
    return (
      <>
        <PageHeader title={m.catalog.title} />
        <Alert tone="info" title={m.unavailable.title}>{m.unavailable.text}</Alert>
      </>
    );
  }
  const sp = await searchParams;
  const fromPlan = sp.plan ? findPlan(library, sp.plan) : null;
  let requested = fromPlan
    ? { distanceKm: fromPlan.distance_km, daysPerWeek: fromPlan.days_per_week, durationWeeks: fromPlan.duration_weeks, level: fromPlan.level }
    : parseFilter(sp);

  const [premium, open, { data: tp }, { count: demoActive }] = await Promise.all([
    hasPremium(session),
    getOpenEnrollment(supabase, user.id),
    supabase.from("training_profiles").select("target_distance").eq("user_id", user.id).maybeSingle<{ target_distance: string }>(),
    supabase.from("user_training_plans").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
  ]);
  if (requested.distanceKm === undefined) requested = { distanceKm: (tp && PROFILE_DISTANCE[tp.target_distance]) || 5 };

  const { filter, options, plan } = catalogSteps(library.plans, requested);
  const durationLabel = (w: number) => library.plans.find((p) => p.duration_weeks === w)?.duration_label ?? fmt(m.catalog.weeks, { n: w });
  const freeWeeks = library.freePreviewWeeks;
  const mondays = startMondays(todayIn(profile.timezone));

  return (
    <>
      <PageHeader title={m.catalog.title} subtitle={m.catalog.subtitle} />

      {open ? (
        <div className="mb-6">
          <Alert tone="info" title={m.catalog.openEnrollment}>
            {m.catalog.openEnrollmentText}{" "}
            <Link href="/plan" className="font-semibold underline">{m.catalog.goToPlan}</Link>
          </Alert>
        </div>
      ) : null}

      <section aria-labelledby="acceso" className="mb-6">
        <h2 id="acceso" className="sr-only">{m.access.title}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardTitle>{m.access.freeTitle}</CardTitle>
            <p className="text-sm text-muted">{fmt(freeWeeks === 1 ? m.access.freeText : m.access.freeTextMany, { n: freeWeeks })}</p>
          </Card>
          <Card className={premium ? undefined : "border-lime-400"}>
            <CardTitle action={premium ? <Badge tone="lime">{m.access.active}</Badge> : null}>{m.access.paidTitle}</CardTitle>
            <p className="text-sm text-muted">{premium ? m.access.activeText : m.access.paidText}</p>
            {premium ? null : (
              <div className="mt-4">
                <ButtonLink href="/suscripcion">{m.access.subscribe}</ButtonLink>
              </div>
            )}
          </Card>
        </div>
      </section>

      <Card className="mb-6 space-y-5" flush>
        <nav aria-label={m.catalog.tabsLabel} className="border-b border-line px-2 pt-2">
          <ul className="grid grid-cols-4">
            {options.distances.map((d) => {
              const active = d === filter.distanceKm;
              return (
                <li key={d}>
                  <Link
                    href={href({ distanceKm: d })}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-12 items-center justify-center border-b-4 text-base font-extrabold transition",
                      active ? "border-lime-400 text-lime-400" : "border-transparent text-muted hover:text-ink",
                    )}
                  >
                    {tabLabel(d)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="space-y-5 px-4 pb-5 sm:px-6">
          <Step
            title={m.catalog.steps.days}
            options={options.days}
            selected={filter.daysPerWeek}
            label={(n) => fmt(m.catalog.daysShort, { n })}
            link={(n) => href({ distanceKm: filter.distanceKm, daysPerWeek: n })}
          />
          <Step
            title={m.catalog.steps.duration}
            options={options.durations}
            selected={filter.durationWeeks}
            label={durationLabel}
            link={(w) => href({ distanceKm: filter.distanceKm, daysPerWeek: filter.daysPerWeek, durationWeeks: w })}
          />
          <Step title={m.catalog.steps.level} options={options.levels} selected={filter.level} label={(l) => l} link={(l) => href({ ...filter, level: l })} />
        </div>
      </Card>

      {plan ? (
        <section id="empezar" aria-labelledby="plan-elegido" className="mb-6 grid scroll-mt-20 gap-4 lg:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold text-muted">{fmt(m.catalog.planNumber, { n: plan.number })}</p>
            <h2 id="plan-elegido" className="mt-1 text-lg font-bold">{plan.title}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>{plan.distance_label}</Badge>
              <Badge>{plan.level}</Badge>
              <Badge>{plan.duration_label}</Badge>
              <Badge>{fmt(m.catalog.days, { n: plan.days_per_week })}</Badge>
            </div>
            <p className="mt-3 text-sm">{plan.main_goal}</p>
            {plan.entry_requirements.length ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">{m.catalog.recommendedIf}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {plan.entry_requirements.map((r) => (
                    <li key={r} className="flex gap-2"><IconCheck className="mt-0.5 shrink-0 text-success" width={16} height={16} />{r}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <Link href={`/planes/${plan.id}`} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline">
              {m.catalog.viewPlan} <IconChevronRight width={16} height={16} />
            </Link>
          </Card>
          {open ? null : (
            <EnrollForm
              planId={plan.id}
              starts={mondays.map((start) => ({ start, race: raceDateFromStart(start, plan.race_week) }))}
              raceWeek={plan.race_week}
              premium={premium}
              hasDemoPlan={(demoActive ?? 0) > 0}
            />
          )}
        </section>
      ) : null}

      <div className="space-y-3">
        <EstimateNotice note={library.version.model_runner_assumptions.note} />
        <SafetyNotices items={library.version.safety} />
      </div>
    </>
  );
}
