import { formatKmValue, formatMinutes, mainSetInKm, type Category, type Speeds } from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconLock } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { DayRow } from "@/lib/data/library";
import { CATEGORY_CLASSES } from "./category";

const m = t.library.workout;
const R = t.library.rating;

const categoryOf = (d: Pick<DayRow, "is_rest" | "category">): Category => (d.is_rest ? "rest" : (d.category ?? "rest"));

/** Resumen de tareas de la semana: cantidad de entrenamientos y tiempo total. */
export function weekSummary(days: DayRow[]): string {
  const sessions = days.filter((d) => !d.is_rest);
  const minutes = sessions.reduce((a, d) => a + (d.duration_min_est ?? 0), 0);
  return fmt(sessions.length === 1 ? m.summaryOne : m.summary, { n: sessions.length, time: formatMinutes(minutes, { round: true }) });
}

/**
 * Un día del plan como tarea: "Día N", qué hacer y los pasos (calentamiento → principal → vuelta
 * a la calma). Sin explicaciones del plan. Los descansos se muestran compactos.
 */
export function WorkoutDay({
  day,
  n,
  legend,
  open = false,
  today = false,
  done = false,
  dateHint,
  tips = false,
  rating = null,
  footer,
  speeds = null,
}: {
  day: DayRow;
  /** Número de día dentro de la semana (1–7). */
  n: number;
  legend: Record<Category, string>;
  open?: boolean;
  today?: boolean;
  done?: boolean;
  dateHint?: string;
  /** Muestra la observación técnica como consejo (pantalla Hoy). */
  tips?: boolean;
  /** Valoración guardada (1–5): se muestra con su carita en el resumen. */
  rating?: number | null;
  /** Contenido extra al final del detalle (por ejemplo, "¿Cómo te fue?"). */
  footer?: ReactNode;
  /** Velocidades del corredor: la parte principal se muestra en km en lugar de minutos. */
  speeds?: Speeds | null;
}) {
  const c = categoryOf(day);
  const badge = (
    <span
      className={cx(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none",
        today ? "bg-accent text-on-accent" : day.is_rest ? "border border-line text-muted" : "bg-surface-2 text-ink",
      )}
      aria-hidden="true"
    >
      <span className="text-xs font-bold uppercase tracking-wider">{m.day}</span>
      <span className="text-lg font-extrabold">{n}</span>
    </span>
  );
  const label = `${fmt(m.dayN, { n })}${today ? ` · ${m.today}` : ""}`;

  if (day.is_rest) {
    return (
      <li className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-3 py-2.5">
        {badge}
        <div className="min-w-0">
          <h3 className="font-semibold text-muted">
            <span className="sr-only">{label}: </span>
            {day.strength_only ? m.strengthOnly : m.rest}
          </h3>
          {dateHint ? <p className="text-xs text-muted">{dateHint}</p> : null}
        </div>
      </li>
    );
  }

  const steps: { label: string; text: string | null }[] = [
    { label: m.warmup, text: day.warmup },
    { label: m.main, text: mainSetInKm(day.main_set, speeds) ?? null },
    { label: m.cooldown, text: day.cooldown },
  ];
  if (day.strength_after) steps.push({ label: m.strength, text: m.strengthText });

  return (
    <li>
      <details open={open} className={cx("group rounded-2xl border bg-surface", today ? "border-primary" : "border-line")}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
          {badge}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-ink">
              <span className="sr-only">{label}: </span>
              {day.session_type}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="tabular font-semibold text-ink">{formatMinutes(day.duration_min_est)}</span>
              {day.distance_km_est ? <span className="tabular">· {formatKmValue(day.distance_km_est, { oneDecimal: true })}</span> : null}
              <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-bold", CATEGORY_CLASSES[c])} title={legend[c]}>{m.category[c]}</span>
              {done ? <span className="rounded-md bg-success-bg px-1.5 py-0.5 text-xs font-bold text-success">✓ {m.done}</span> : null}
              {rating ? (
                <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-ink">
                  <span aria-hidden="true">{R.emoji[rating as 1]} </span>
                  {R.options[rating as 1]}
                </span>
              ) : null}
            </p>
            {dateHint ? <p className="mt-0.5 text-xs text-muted">{dateHint}</p> : null}
          </div>
          <span aria-hidden="true" className="text-muted transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-line px-3 pb-4 pt-3">
          <ol className="relative space-y-4 pl-6">
            <span aria-hidden="true" className="absolute bottom-2 left-[7px] top-2 w-0.5 rounded bg-line" />
            {steps.map((s, i) => (
              <li key={s.label} className="relative">
                <span
                  aria-hidden="true"
                  className={cx("absolute -left-6 top-1 size-4 rounded-full border-2", i === 1 ? "border-primary bg-primary" : "border-primary bg-surface")}
                />
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{s.label}</p>
                <p className={cx("mt-0.5 text-ink", i === 1 ? "text-base font-semibold" : "text-sm")}>{s.text}</p>
              </li>
            ))}
          </ol>
          {day.intensity ? (
            <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <span className="font-semibold text-muted">{m.intensity}: </span>
              {day.intensity}
            </p>
          ) : null}
          {tips && day.technical_notes ? <p className="mt-2 text-sm text-muted">💡 {day.technical_notes}</p> : null}
          {footer}
        </div>
      </details>
    </li>
  );
}

export type WeekPill = { key: string; label: string; href: string; locked: boolean; selected: boolean; current: boolean };

/** Tira de semanas desplazable (S1 … SN): la elegida resaltada, la actual con un punto, las bloqueadas con candado. */
export function WeekStrip({ pills }: { pills: WeekPill[] }) {
  return (
    <nav aria-label={m.weeks} className="-mx-1 overflow-x-auto pb-1">
      <ul className="flex gap-2 px-1">
        {pills.map((p) => (
          <li key={p.key} className="shrink-0">
            <Link
              href={p.href}
              scroll={false}
              aria-current={p.selected ? "page" : undefined}
              aria-label={`${p.label}${p.locked ? `, ${m.locked}` : ""}${p.current ? `, ${m.current}` : ""}`}
              className={cx(
                "relative inline-flex min-h-11 min-w-12 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-bold tabular transition",
                p.selected ? "border-primary-ink bg-accent text-on-accent" : p.locked ? "border-line bg-surface-2 text-muted" : "border-line bg-surface text-ink hover:border-primary",
              )}
            >
              {p.locked ? <IconLock width={12} height={12} /> : null}
              {p.label.replace(/\D+/g, "") || p.label}
              {p.current && !p.selected ? <span aria-hidden="true" className="absolute -top-1 right-1 size-2.5 rounded-full border-2 border-surface bg-primary" /> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** De dónde salen los km de la parte principal: el test del corredor o el nivel del plan. */
export function KmNote({ testDate }: { testDate: string | null }) {
  return (
    <p className="text-xs text-muted">
      {testDate ? (
        fmt(m.kmFromTest, { date: formatDate(testDate, "long") })
      ) : (
        <>
          {m.kmFromModel}{" "}
          <Link href="/calculadora" className="font-semibold underline">{m.kmCalculator}</Link> {m.kmFromModelEnd}
        </>
      )}
    </p>
  );
}
