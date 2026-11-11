import { effortLabel, formatClock, formatKmValue, formatMinutes, formatPace, mainSetInKm, paceForPct, sessionBlocks, type Speeds } from "@runner360/plan-library";
import { fmt, t } from "@/i18n";
import type { DayRow, WeekRow } from "@/lib/data/library";
import type { WeekPdfData, WeekPdfDay } from "./week-pdf";

const w = t.library.workout;
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const parts = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)), d: Number(iso.slice(8, 10)) });
const weekday = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;

/** "9 al 15 de noviembre de 2026" (o "28 de octubre al 3 de noviembre de 2026"). */
export function rangeLabel(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  if (a.y !== b.y) return `${a.d} de ${MONTHS[a.m - 1]} de ${a.y} al ${b.d} de ${MONTHS[b.m - 1]} de ${b.y}`;
  if (a.m !== b.m) return `${a.d} de ${MONTHS[a.m - 1]} al ${b.d} de ${MONTHS[b.m - 1]} de ${b.y}`;
  return `${a.d} al ${b.d} de ${MONTHS[b.m - 1]} de ${b.y}`;
}

export type WeekPdfInput = {
  planTitle: string;
  planMeta: string;
  athlete: string | null;
  planWeek: number;
  totalWeeks: number;
  week: WeekRow | null;
  dated: { day: DayRow; date: string }[];
  logs: { workout_date: string; status: string; distance_m: number | null; duration_s: number | null; rpe: number | null }[];
  test: { meters: number; seconds: number } | null;
  testDate: string | null;
  speeds: Speeds | null;
  today: string;
  generatedAt: string;
};

/** Arma el contenido del PDF de la semana a partir del plan, el test de ritmos y lo registrado. */
export function weekPdfData(input: WeekPdfInput): WeekPdfData {
  const days = [...input.dated].sort((a, b) => a.date.localeCompare(b.date));
  const running = days.filter((x) => !x.day.is_rest);
  const minutes = running.reduce((a, x) => a + (x.day.duration_min_est ?? 0), 0);
  const km = running.reduce((a, x) => a + (x.day.distance_km_est ?? 0), 0);
  const summary = [
    fmt(running.length === 1 ? w.summaryOne : w.summary, { n: running.length, time: formatMinutes(minutes, { round: true }) }),
    km > 0 ? `~${formatKmValue(km, { oneDecimal: true })}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pdfDays: WeekPdfDay[] = days.map(({ day, date }) => {
    const { d, m } = parts(date);
    const log = input.logs.find((l) => l.workout_date === date && l.status !== "skipped");
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
            pace: l.pct !== null && input.test ? `Ritmo ${formatPace(paceForPct(input.test, l.pct))}` : null,
            notes: [l.recovery, l.note].filter((x): x is string => Boolean(x)),
          })),
        };
      });
    return {
      label: `${WEEKDAYS[weekday(date)]} ${d}/${m}`,
      isRest: day.is_rest,
      restLabel: day.is_rest ? (day.strength_only ? w.strengthOnly : w.rest) : null,
      title: day.short_label ?? day.session_type,
      volume: day.is_rest
        ? null
        : [day.distance_km_est ? formatKmValue(day.distance_km_est, { oneDecimal: true }) : null, day.duration_min_est ? formatMinutes(day.duration_min_est, { round: true }) : null]
            .filter(Boolean)
            .join(" · ") || null,
      blocks,
      tips: day.technical_notes,
      strength: day.strength_after ? `${w.strength}: ${w.strengthText.toLowerCase()}.` : null,
      done: log
        ? [log.distance_m ? formatKmValue(log.distance_m / 1000, { oneDecimal: true }) : null, log.duration_s ? formatClock(log.duration_s) : null, log.rpe ? `RPE ${log.rpe}` : null]
            .filter(Boolean)
            .join(" · ") || "Sí"
        : null,
      today: date === input.today,
    };
  });

  const first = days[0]?.date ?? input.today;
  const last = days.at(-1)?.date ?? input.today;
  return {
    planTitle: input.planTitle,
    planMeta: input.planMeta,
    athlete: input.athlete,
    weekLabel: fmt(w.weekOf, { n: input.planWeek, total: input.totalWeeks }),
    range: rangeLabel(first, last),
    summary,
    goal: input.week?.weekly_goal ?? null,
    criterion: input.week?.progression_criterion ?? null,
    paceNote: input.test && input.testDate
      ? `Ritmos calculados con tu test del ${parts(input.testDate).d}/${parts(input.testDate).m}/${parts(input.testDate).y} (100 %).`
      : "Cada tramo indica su porcentaje y su RPE. Cargá tu test en la Calculadora de la app para ver el ritmo por km de cada tramo.",
    days: pdfDays,
    rpeNote: `${w.rpeText} Plan de entrenamiento con fines deportivos: ante dolor o molestias inusuales, detené la sesión y consultá a un profesional.`,
    generatedAt: input.generatedAt,
  };
}
