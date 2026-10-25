import { formatKmValue, formatMinutes, mainSetInKm, type Speeds } from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconLock } from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { DayRow } from "@/lib/data/library";
import { RpeHelp, SessionDetail, type PaceTest } from "./session-detail";

const m = t.library.workout;
const R = t.library.rating;


/** Resumen de tareas de la semana: cantidad de entrenamientos y tiempo total. */
export function weekSummary(days: DayRow[]): string {
  const sessions = days.filter((d) => !d.is_rest);
  const minutes = sessions.reduce((a, d) => a + (d.duration_min_est ?? 0), 0);
  return fmt(sessions.length === 1 ? m.summaryOne : m.summary, { n: sessions.length, time: formatMinutes(minutes, { round: true }) });
}

/**
 * Un día del plan como tarea. Encabezado: día, km totales y duración estimada. Adentro, la sesión en
 * tres franjas (entrada en calor, parte principal y vuelta a la calma) con su porcentaje y RPE.
 * Los descansos se muestran compactos.
 */
export function WorkoutDay({
  day,
  n,
  open = false,
  today = false,
  done = false,
  dateHint,
  tips = false,
  rating = null,
  footer,
  speeds = null,
  test = null,
}: {
  day: DayRow;
  /** Número de día dentro de la semana (1–7). */
  n: number;
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
  /** Velocidades del corredor (contenido anterior a 2026.12: la parte principal se pasa a km). */
  speeds?: Speeds | null;
  /** Test de la Calculadora: muestra el ritmo de cada porcentaje. */
  test?: PaceTest | null;
}) {
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

  return (
    <li>
      <details open={open} className={cx("group rounded-2xl border bg-surface", today ? "border-primary" : "border-line")}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
          {badge}
          <div className="min-w-0 flex-1">
            <h3 className="tabular text-lg font-extrabold leading-tight text-ink">
              <span className="sr-only">{label}: </span>
              {day.distance_km_est ? formatKmValue(day.distance_km_est, { oneDecimal: true }) : null}
              <span className="font-semibold text-muted"> · {formatMinutes(day.duration_min_est, { round: true })}</span>
            </h3>
            {done || rating || dateHint ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {dateHint ? <span>{dateHint}</span> : null}
                {done ? <span className="rounded-md bg-success-bg px-1.5 py-0.5 text-xs font-bold text-success">✓ {m.done}</span> : null}
                {rating ? (
                  <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-ink">
                    <span aria-hidden="true">{R.emoji[rating as 1]} </span>
                    {R.options[rating as 1]}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <span aria-hidden="true" className="text-muted transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="border-t border-line px-3 pb-4 pt-2">
          <RpeHelp />
          <SessionDetail day={day} test={test} speeds={speeds} />
          {day.strength_after ? (
            <p className="mt-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="font-semibold">{m.strength}: </span>
              {m.strengthText}
            </p>
          ) : null}
          {tips && day.technical_notes ? <p className="mt-3 text-sm text-muted">💡 {day.technical_notes}</p> : null}
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

/**
 * De dónde salen los km de la parte principal. Si el contenido ya viene en km (desde la versión
 * 2026.11) no hay conversión: se explica el porcentaje y se manda a la Calculadora.
 */
export function KmNote({ testDate, days, speeds }: { testDate: string | null; days: DayRow[]; speeds: Speeds | null }) {
  const converted = days.some((d) => !d.is_rest && d.main_set && mainSetInKm(d.main_set, speeds) !== d.main_set);
  if (!converted)
    return (
      <p className="text-xs text-muted">
        {testDate ? (
          fmt(m.paceFromTest, { date: formatDate(testDate, "long") })
        ) : (
          <>
            {m.kmFromPlan} <Link href="/calculadora" className="font-semibold underline">{m.kmCalculator}</Link> {m.kmFromPlanEnd}
          </>
        )}
      </p>
    );
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
