import { formatKmValue, formatMinutes, overallAdherence, scheduledWeeks, weeklyProgress, zonePercents, type ZoneSplit } from "@runner360/plan-library";
import { formatDate, formatPercent } from "@runner360/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card, CardTitle, Stat } from "@/components/ui/primitives";
import { fmt, t } from "@/i18n";
import type { OpenEnrollment } from "@/lib/data/enrollment";
import { getPlanWeeks } from "@/lib/data/library";
import { getLogs } from "@/lib/library/week";

const P = t.library.progress;
const zones = (z: ZoneSplit | null) => (z ? `Z1 ${z.Z1}% · Z2 ${z.Z2}% · Z3 ${z.Z3}%` : "—");

/** Planificado contra real por semana, adherencia y distribución Z1/Z2/Z3 (sección de /progreso). */
export async function PlanProgress({ supabase, open, today }: { supabase: SupabaseClient; open: OpenEnrollment; today: string }) {
  const { enrollment, plan, library } = open;
  const [weekRows, daysRes, logs] = await Promise.all([
    getPlanWeeks(enrollment.content_version, plan.id),
    supabase
      .from("library_days")
      .select("week, day_index, is_rest, minutes_by_intensity")
      .eq("content_version", enrollment.content_version)
      .eq("plan_id", plan.id),
    getLogs(supabase, enrollment.id, enrollment.start_date, today),
  ]);
  const rows = weeklyProgress({
    weeks: scheduledWeeks(open.segments, plan.duration_weeks),
    weekRows: weekRows ?? [],
    days: (daysRes.data ?? []) as { week: number; day_index: number; is_rest: boolean; minutes_by_intensity: Record<string, number> | null }[],
    logs: logs.map((l) => ({ date: l.workout_date, planDayIndex: l.plan_day_index, status: l.status, durationS: l.duration_s, distanceM: l.distance_m })),
    dayMap: enrollment.day_map,
    zoneMap: library.version.zone_map,
    today,
  });
  const adherence = overallAdherence(rows);
  const due = rows.reduce((s, r) => s + r.dueSessions, 0);
  const done = rows.reduce((s, r) => s + Math.min(r.doneSessions, r.dueSessions), 0);

  return (
    <Card className="mb-6">
      <CardTitle>{P.title}</CardTitle>
      <p className="mb-4 text-sm text-muted">{fmt(P.subtitle, { plan: plan.title })}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{P.empty}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={P.adherence} value={formatPercent(adherence)} hint={fmt(P.adherenceHint, { done, due })} />
            <Stat label={`${P.planned} (km)`} value={formatKmValue(rows.reduce((s, r) => s + r.plannedKm, 0), { oneDecimal: true })} />
            <Stat label={`${P.real} (km)`} value={formatKmValue(rows.reduce((s, r) => s + r.realKm, 0), { oneDecimal: true })} />
            <Stat label={`${P.real} (tiempo)`} value={formatMinutes(rows.reduce((s, r) => s + r.realMin, 0), { round: true })} />
          </div>
          {/* Desplazable con teclado en pantallas chicas (región enfocable con nombre). */}
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={P.title}>
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">{P.title}</caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3">{P.week}</th>
                  <th scope="col" className="py-2 pr-3">{P.planned}</th>
                  <th scope="col" className="py-2 pr-3">{P.real}</th>
                  <th scope="col" className="py-2 pr-3">{P.sessions}</th>
                  <th scope="col" className="py-2 pr-3">{P.zonesPlanned}</th>
                  <th scope="col" className="py-2">{P.zonesDone}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular">
                {rows.map((r) => (
                  <tr key={r.weekStart}>
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {fmt(t.library.detail.weekShort, { n: r.planWeek })} <span className="font-normal text-muted">· {formatDate(r.weekStart)}</span>
                    </th>
                    <td className="py-2 pr-3">{formatKmValue(r.plannedKm, { oneDecimal: true })} · {formatMinutes(r.plannedMin, { round: true })}</td>
                    <td className="py-2 pr-3">{formatKmValue(r.realKm, { oneDecimal: true })} · {formatMinutes(r.realMin, { round: true })}</td>
                    <td className="py-2 pr-3">{r.doneSessions}/{r.dueSessions}</td>
                    <td className="py-2 pr-3">{zones(r.zonesPlanned)}</td>
                    <td className="py-2">{zones(zonePercents(r.zonesDoneMin))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">{P.zonesNote}</p>
        </>
      )}
    </Card>
  );
}
