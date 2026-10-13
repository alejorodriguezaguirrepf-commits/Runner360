import { catalogSteps, formatKmValue, LEVELS, type CatalogFilter, type Level } from "@runner360/plan-library";
import type { Metadata } from "next";
import Link from "next/link";
import { EstimateNotice, SafetyNotices } from "@/components/library/notices";
import { IconChevronRight } from "@/components/ui/icons";
import { Alert, Badge, ButtonLink, Card, cx, PageHeader } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import { requireOnboardedSession } from "@/lib/auth";
import { getLibrary } from "@/lib/data/library";

export const metadata: Metadata = { title: "Planes de entrenamiento" };

const m = t.library;

type Search = { d?: string; n?: string; s?: string; dias?: string };

function parseFilter(sp: Search): CatalogFilter {
  const num = (v?: string) => (v && /^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);
  return {
    distanceKm: num(sp.d),
    level: LEVELS.includes(sp.n as Level) ? (sp.n as Level) : undefined,
    durationWeeks: num(sp.s),
    daysPerWeek: num(sp.dias),
  };
}

/** URL del catálogo con el filtro dado; cambiar un paso borra los posteriores. */
function href(f: CatalogFilter): string {
  const q = new URLSearchParams();
  if (f.distanceKm !== undefined) q.set("d", String(f.distanceKm));
  if (f.level) q.set("n", f.level);
  if (f.durationWeeks !== undefined) q.set("s", String(f.durationWeeks));
  if (f.daysPerWeek !== undefined) q.set("dias", String(f.daysPerWeek));
  const s = q.toString();
  return s ? `/planes?${s}` : "/planes";
}

function Step<T extends string | number>({
  title,
  options,
  selected,
  label,
  link,
}: {
  title: string;
  options: T[];
  selected: T | undefined;
  label: (v: T) => string;
  link: (v: T) => string;
}) {
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
                aria-current={active ? "true" : undefined}
                className={cx(
                  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition",
                  active ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-surface text-ink hover:border-navy-700",
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

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireOnboardedSession();
  const library = await getLibrary();
  if (!library) {
    return (
      <>
        <PageHeader title={m.catalog.title} />
        <Alert tone="info" title={m.unavailable.title}>{m.unavailable.text}</Alert>
      </>
    );
  }
  const requested = parseFilter(await searchParams);
  const { filter, options, results } = catalogSteps(library.plans, requested);
  const distanceLabel = (km: number) => library.plans.find((p) => p.distance_km === km)?.distance_label ?? formatKmValue(km);
  const durationLabel = (w: number) => library.plans.find((p) => p.duration_weeks === w)?.duration_label ?? fmt(m.catalog.weeks, { n: w });

  return (
    <>
      <PageHeader
        title={m.catalog.title}
        subtitle={m.catalog.subtitle}
        actions={<ButtonLink href="/planes/elegir">{m.catalog.assistantCta}</ButtonLink>}
      />
      <div className="mb-6 space-y-3">
        <EstimateNotice note={library.version.model_runner_assumptions.note} />
        <SafetyNotices items={library.version.safety} />
      </div>

      <Card className="mb-6 space-y-5">
        <Step title={m.catalog.steps.distance} options={options.distances} selected={filter.distanceKm} label={distanceLabel} link={(d) => href({ distanceKm: d })} />
        <Step title={m.catalog.steps.level} options={options.levels} selected={filter.level} label={(l) => l} link={(l) => href({ distanceKm: filter.distanceKm, level: l })} />
        <Step
          title={m.catalog.steps.duration}
          options={options.durations}
          selected={filter.durationWeeks}
          label={durationLabel}
          link={(s) => href({ distanceKm: filter.distanceKm, level: filter.level, durationWeeks: s })}
        />
        <Step
          title={m.catalog.steps.days}
          options={options.days}
          selected={filter.daysPerWeek}
          label={(n) => String(n)}
          link={(n) => href({ ...filter, daysPerWeek: n })}
        />
        {filter.distanceKm !== undefined ? (
          <Link href="/planes" className="inline-block text-sm font-semibold text-muted underline">{m.catalog.reset}</Link>
        ) : null}
      </Card>

      <section aria-labelledby="resultados">
        <h2 id="resultados" className="mb-3 text-sm font-semibold text-muted" aria-live="polite">
          {fmt(m.catalog.results, { n: results.length })}
        </h2>
        {results.length === 0 ? (
          <p className="text-sm text-muted">{m.catalog.noResults}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {results.map((p) => (
              <li key={p.id}>
                <Link href={`/planes/${p.id}`} className="flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 transition hover:border-navy-700">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs font-semibold text-muted">{fmt(m.catalog.planNumber, { n: p.number })}</p>
                    <p className="font-bold text-ink">{p.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{p.distance_label}</Badge>
                      <Badge>{p.level}</Badge>
                      <Badge>{p.duration_label}</Badge>
                      <Badge>{fmt(m.catalog.days, { n: p.days_per_week })}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {p.min_weekly_km !== null ? fmt(m.catalog.minWeeklyKm, { km: p.min_weekly_km }) : m.catalog.noMinWeeklyKm}
                    </p>
                  </div>
                  <IconChevronRight className="mt-1 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
