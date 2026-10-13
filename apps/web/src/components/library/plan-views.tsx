import { DAY_LABELS, formatKmValue, formatMinutes, type Category } from "@runner360/plan-library";
import Link from "next/link";
import { IconLock } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { DayRow, OverviewDay, WeekRow } from "@/lib/data/library";
import { CATEGORY_CLASSES, CategoryTag } from "./category";

const m = t.library;

const weekTotals = (w: WeekRow) => `${formatKmValue(w.distance_km_est, { oneDecimal: true })} · ${formatMinutes(w.duration_min_est, { round: true })}`;

function dayCategory(d: Pick<DayRow, "is_rest" | "category">): Category {
  return d.is_rest ? "rest" : (d.category ?? "rest");
}

/**
 * Vista rápida de todas las semanas: grilla de 7 columnas coloreada por categoría, siempre con
 * texto. Las semanas sin acceso muestran solo los totales (públicos).
 */
export function WeekOverview({
  weeks,
  days,
  legend,
  hrefForWeek,
  currentWeek,
}: {
  weeks: WeekRow[];
  days: OverviewDay[];
  legend: Record<Category, string>;
  hrefForWeek: (week: number) => string;
  currentWeek?: number | null;
}) {
  const byWeek = new Map<number, OverviewDay[]>();
  for (const d of days) byWeek.set(d.week, [...(byWeek.get(d.week) ?? []), d]);
  // Semanas visibles con su grilla; las bloqueadas se resumen en una fila (sus totales son públicos).
  const open = weeks.filter((w) => byWeek.get(w.week)?.length === 7);
  const locked = weeks.filter((w) => byWeek.get(w.week)?.length !== 7);
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-left text-xs">
          <caption className="sr-only">{m.detail.overview}</caption>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="w-14 font-semibold">{m.detail.phaseWeeks}</th>
              {DAY_LABELS.map((d) => (
                <th key={d} scope="col" className="text-center font-semibold">{d}</th>
              ))}
              <th scope="col" className="w-28 font-semibold">{m.detail.weekTotals}</th>
            </tr>
          </thead>
          <tbody>
            {open.map((w) => {
              const row = byWeek.get(w.week)!;
              return (
                <tr key={w.week} className={cx(currentWeek === w.week && "outline outline-2 outline-lime-500")}>
                  <th scope="row" className="font-semibold">
                    <Link href={hrefForWeek(w.week)} className="inline-flex min-h-9 items-center rounded px-1 underline-offset-2 hover:underline">
                      {fmt(m.detail.weekShort, { n: w.week })}
                    </Link>
                  </th>
                  {row.map((d) => {
                    const c = dayCategory(d);
                    return (
                      <td key={d.day_index} className={cx("h-10 rounded-md px-1 text-center align-middle font-semibold", CATEGORY_CLASSES[c])}>
                        <span className="sr-only">{DAY_LABELS[d.day_index]}: {legend[c]}. </span>
                        <span className="block leading-tight">
                          {d.is_rest ? (d.strength_only ? "+F" : "—") : d.short_label}
                          {d.is_quality ? <span aria-label={m.day.quality}> ★</span> : null}
                        </span>
                      </td>
                    );
                  })}
                  <td className="tabular whitespace-nowrap text-muted">{weekTotals(w)}</td>
                </tr>
              );
            })}
            {locked.length ? (
              <tr>
                <th scope="row" className="font-semibold">{fmt(m.detail.weekShort, { n: locked[0]!.week })}+</th>
                <td colSpan={8} className="h-10 rounded-md bg-canvas px-2 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <IconLock width={14} height={14} /> {fmt(m.detail.lockedWeeks, { from: locked[0]!.week, to: locked[locked.length - 1]!.week })}
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {locked.length ? (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            {fmt(m.detail.lockedTotals, { from: locked[0]!.week, to: locked[locked.length - 1]!.week })}
          </summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {locked.map((w) => (
              <li key={w.week} className="flex justify-between gap-3 rounded-lg bg-canvas px-3 py-1.5">
                <Link href={hrefForWeek(w.week)} className="font-semibold underline-offset-2 hover:underline">{fmt(m.detail.weekShort, { n: w.week })} · {w.phase}</Link>
                <span className="tabular text-muted">{weekTotals(w)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Encabezado de una semana: fase, tipo, objetivo, criterio para avanzar y totales. */
export function WeekHeader({ week }: { week: WeekRow }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-muted">{m.week.phase}</dt><dd className="font-semibold">{week.phase}</dd></div>
      <div><dt className="text-muted">{m.week.type}</dt><dd className="font-semibold">{week.week_type_label}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted">{m.week.goal}</dt><dd>{week.weekly_goal}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted">{m.week.criterion}</dt><dd>{week.progression_criterion}</dd></div>
      <div className="sm:col-span-2 text-muted">
        <dd className="tabular">
          {fmt(m.week.totals, { km: formatKmValue(week.distance_km_est), min: formatMinutes(week.duration_min_est, { round: true }), sessions: week.running_sessions })}
          {week.strength_sessions > 0 ? ` · ${fmt(m.week.strengthSessions, { n: week.strength_sessions })}` : ""}
          {" · "}
          {fmt(m.week.zones, { z1: week.zone_pct.Z1, z2: week.zone_pct.Z2, z3: week.zone_pct.Z3 })}
        </dd>
      </div>
    </dl>
  );
}

/** Un día con todas las columnas del contenido (descansos incluidos). */
export function DayCard({ day, legend, dateLabel, headingLevel = 3 }: { day: DayRow; legend: Record<Category, string>; dateLabel?: string; headingLevel?: 3 | 4 }) {
  const H = headingLevel === 3 ? "h3" : "h4";
  const c = dayCategory(day);
  const title = (
    <div className="flex flex-wrap items-center gap-2">
      <H className="font-bold text-ink">
        {dateLabel ?? DAY_LABELS[day.day_index]}
        {day.is_rest ? ` · ${day.strength_only ? m.day.strengthOnly : m.day.rest}` : ` · ${day.session_type}`}
      </H>
      <CategoryTag category={c} legend={legend} />
      {day.is_quality ? <span className="rounded-md border border-line px-1.5 py-0.5 text-[11px] font-semibold">★ {m.day.quality}</span> : null}
    </div>
  );
  if (day.is_rest) {
    return <article className={cx("rounded-xl border border-line p-3", "bg-canvas")}>{title}</article>;
  }
  const rows: [string, string | null][] = [
    [m.day.goal, day.physiological_goal],
    [m.day.warmup, day.warmup],
    [m.day.main, day.main_set],
    [m.day.cooldown, day.cooldown],
    [m.day.intensity, day.intensity],
    [m.day.notes, day.technical_notes],
  ];
  return (
    <article className="rounded-xl border border-line bg-surface p-3">
      {title}
      <p className="mt-1 text-sm text-muted">
        <span className="font-semibold text-ink">{day.short_label}</span> · {m.day.duration}: {formatMinutes(day.duration_min_est)} · {m.day.distance}: {formatKmValue(day.distance_km_est)}
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5 sm:grid-cols-[11rem_1fr]">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {day.strength_after ? <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs font-semibold text-ink">+F · {m.day.strengthAfter}</p> : null}
    </article>
  );
}
