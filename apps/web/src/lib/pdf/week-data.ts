import { effortLabel, formatKmValue, formatMinutes, formatPace, mainSetInKm, paceForPct, sessionBlocks, type Speeds } from "@runner360/plan-library";
import { formatDate } from "@runner360/shared";
import { fmt, t } from "@/i18n";
import type { DayRow } from "@/lib/data/library";
import type { WeekPdfData, WeekPdfDay } from "./week-pdf";

const w = t.library.workout;
export type WeekPdfInput = {
  planTitle: string;
  planMeta: string;
  athlete: string | null;
  planWeek: number;
  totalWeeks: number;
  dated: { day: DayRow; date: string }[];
  logs: { workout_date: string; status: string; distance_m: number | null; duration_s: number | null; rpe: number | null }[];
  test: { meters: number; seconds: number } | null;
  testDate: string | null;
  speeds: Speeds | null;
  today: string;
  generatedAt: string;
};

/** "19 oct": fecha corta, como en la pantalla del plan. */
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");

/**
 * Arma el contenido del PDF de la semana tal como se ve en Mi plan: solo los días de entrenamiento
 * (Día 1, Día 2…), sin descansos ni días de solo fuerza.
 */
export function weekPdfData(input: WeekPdfInput): WeekPdfData {
  const all = [...input.dated].sort((a, b) => a.date.localeCompare(b.date));
  const running = all.filter((x) => !x.day.is_rest);
  const minutes = running.reduce((a, x) => a + (x.day.duration_min_est ?? 0), 0);
  const summary = fmt(running.length === 1 ? w.summaryOne : w.summary, { n: running.length, time: formatMinutes(minutes, { round: true }) });

  const pdfDays: WeekPdfDay[] = running.map(({ day, date }, i) => {
    const blocks = sessionBlocks(day)
      .filter((b) => b.lines.length > 0)
      .map((b) => {
        const legacy = b.lines.length === 1 && b.lines[0]!.pct === null && b.kind === "main";
        const lines = legacy ? [{ ...b.lines[0]!, what: mainSetInKm(b.lines[0]!.what, input.speeds) ?? b.lines[0]!.what }] : b.lines;
        return {
          name: b.kind === "warmup" ? w.warmup : b.kind === "main" ? w.main : w.cooldown,
          total: b.total ? fmt(w.total, { km: b.total }) : null,
          lines: lines.map((l) => ({
            what: l.what,
            effort: l.pct !== null ? effortLabel(l.pct) : null,
            pace: l.pct !== null && input.test ? fmt(w.pace, { pace: formatPace(paceForPct(input.test, l.pct)).replace("/km", "") }) : null,
            notes: [l.recovery, l.note].filter((x): x is string => Boolean(x)),
          })),
        };
      });
    return {
      label: fmt(w.dayN, { n: i + 1 }),
      dateHint: shortDate(date),
      volume: [day.distance_km_est ? formatKmValue(day.distance_km_est, { oneDecimal: true }) : null, formatMinutes(day.duration_min_est, { round: true })].filter(Boolean).join(" · "),
      blocks,
      strength: day.strength_after ? `${w.strength}: ${w.strengthText}` : null,
      done: input.logs.some((l) => l.workout_date === date && l.status !== "skipped"),
      today: date === input.today,
    };
  });

  const first = all[0]?.date ?? input.today;
  const last = all.at(-1)?.date ?? input.today;
  return {
    planTitle: input.planTitle,
    planMeta: input.planMeta,
    athlete: input.athlete,
    weekLabel: fmt(w.weekOf, { n: input.planWeek, total: input.totalWeeks }),
    range: `${shortDate(first)} – ${shortDate(last)}`,
    summary,
    paceNote: input.test && input.testDate ? fmt(w.paceFromTest, { date: formatDate(input.testDate, "long") }) : `${w.kmFromPlan} ${w.kmCalculator} ${w.kmFromPlanEnd}`,
    days: pdfDays,
    rpeNote: `${w.rpeHelp} ${w.rpeText}`,
    generatedAt: input.generatedAt,
  };
}
