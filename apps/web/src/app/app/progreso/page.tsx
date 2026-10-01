import type { Metadata } from "next";
import { LineChart } from "lucide-react";
import { formatDate, formatDuration, formatKm, formatPace } from "@runner360/shared";
import {
  addDays,
  computeCompliance,
  consistency,
  fillWeeks,
  monthlyTotals,
  paceSecondsPerKm,
  personalBests,
  startOfIsoWeek,
  totals,
  weeklyTotals,
} from "@runner360/training-engine";
import { BarChart } from "@/components/charts/bar-chart";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { hasFeature, requireOnboardedViewer } from "@/lib/auth";
import { loadActivePlan, loadWorkouts, toWorkoutLike } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";

export const metadata: Metadata = { title: "Progreso" };

const WEEKS = 12;

export default async function ProgressPage() {
  const viewer = await requireOnboardedViewer("/app/progreso");
  const supabase = await createClient();
  const today = todayKey(viewer.timezone);
  const advanced = hasFeature(viewer, "advanced_stats");
  const [workouts, plan, { data: results }] = await Promise.all([
    loadWorkouts(supabase, viewer.id, new Date(Date.now() - 400 * 86_400_000).toISOString(), 2000),
    loadActivePlan(supabase, viewer.id),
    supabase.from("competition_results").select("finish_time_s, competitions(name, distance_m, race_date)"),
  ]);
  const logs = workouts.map(toWorkoutLike);
  if (logs.length === 0) {
    return (
      <>
        <PageHeader title="Progreso" />
        <EmptyState icon={LineChart} title="Sin datos todavía" action={<ButtonLink href="/app/registrar">Registrar entrenamiento</ButtonLink>}>
          Tu evolución se construye con tus registros reales. No mostramos datos estimados ni de ejemplo.
        </EmptyState>
      </>
    );
  }

  const thisMonday = startOfIsoWeek(today);
  const weekly = fillWeeks(weeklyTotals(logs, viewer.timezone), addDays(thisMonday, -7 * (WEEKS - 1)), thisMonday);
  const all = totals(logs);
  const last28 = totals(logs.filter((l) => new Date(l.startedAt).getTime() > Date.now() - 28 * 86_400_000));
  const monthly = monthlyTotals(logs, viewer.timezone).slice(-6).reverse();
  const cons = consistency(weekly, 8);
  const compliance = plan
    ? computeCompliance(plan.calendar.map((c) => ({ id: c.id, scheduledDate: c.scheduledDate, isRest: c.session.type === "rest", logStatus: c.log?.status ?? null })), today)
    : null;
  type R = { finish_time_s: number; competitions: { name: string; distance_m: number; race_date: string } };
  const pbs = personalBests(((results ?? []) as unknown as R[]).map((r) => ({ name: r.competitions.name, distanceM: r.competitions.distance_m, raceDate: r.competitions.race_date, finishTimeS: r.finish_time_s })));
  const weekLabel = (k: string) => formatDate(k, { day: "numeric", month: "short", year: undefined });

  return (
    <>
      <PageHeader title="Progreso" description="Calculado exclusivamente a partir de tus entrenamientos registrados." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Km últimos 28 días" value={formatKm(last28.distanceM, 1)} />
        <Stat label="Tiempo últimos 28 días" value={formatDuration(last28.durationS)} />
        <Stat label="Sesiones registradas" value={all.workouts} hint="Últimos 12 meses" />
        <Stat label="Ritmo medio global" value={formatPace(paceSecondsPerKm(all.distanceM, all.durationS))} hint="Solo sesiones con distancia" />
      </div>

      <Card className="mt-4">
        <CardHeader title="Kilómetros por semana" description={`Últimas ${WEEKS} semanas`} />
        <BarChart title="Kilómetros por semana" unitLabel="Distancia" data={weekly.map((w) => ({ key: w.key, label: weekLabel(w.key), value: w.distanceM, display: formatKm(w.distanceM, 1) }))} />
      </Card>

      {advanced ? (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Tiempo de entrenamiento por semana" />
              <BarChart title="Tiempo de entrenamiento por semana" unitLabel="Tiempo" data={weekly.map((w) => ({ key: w.key, label: weekLabel(w.key), value: w.durationS, display: formatDuration(w.durationS) }))} />
            </Card>
            <Card>
              <CardHeader title="Consistencia y cumplimiento" />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Consistencia (8 semanas)" value={cons == null ? "—" : `${Math.round(cons * 100)}%`} hint="Semanas con al menos un entrenamiento" />
                <Stat
                  label="Cumplimiento del plan"
                  value={compliance?.rate != null ? `${Math.round(compliance.rate * 100)}%` : "—"}
                  hint={compliance ? `${compliance.completed + compliance.modified} de ${compliance.due} sesiones vencidas` : "Sin plan activo"}
                />
              </div>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Resumen mensual" />
              <table className="tabular w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted"><tr><th scope="col" className="py-2">Mes</th><th scope="col">Distancia</th><th scope="col">Tiempo</th><th scope="col">Sesiones</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {monthly.map((m) => (
                    <tr key={m.key}>
                      <td className="py-2">{formatDate(`${m.key}-01`, { day: undefined, month: "long" })}</td>
                      <td>{formatKm(m.distanceM, 1)}</td>
                      <td>{formatDuration(m.durationS)}</td>
                      <td>{m.workouts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card>
              <CardHeader title="Marcas personales" description="Resultados reales registrados en Competencias." />
              {pbs.length === 0 ? (
                <p className="text-sm text-muted">Todavía no registraste resultados de competencias.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {pbs.map((p) => (
                    <li key={p.distanceM} className="tabular flex justify-between py-2">
                      <span>{formatKm(p.distanceM, 3)} · {p.name}</span>
                      <span className="font-semibold">{formatDuration(p.finishTimeS)} <span className="font-normal text-muted">({formatPace(paceSecondsPerKm(p.distanceM, p.finishTimeS))})</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : (
        <Alert className="mt-4" title="Estadísticas avanzadas">
          Tiempo semanal, consistencia, cumplimiento, resumen mensual y marcas personales están incluidos en Premium.{" "}
          <a href="/app/suscripcion" className="font-semibold underline">Ver Premium</a>
        </Alert>
      )}
    </>
  );
}
