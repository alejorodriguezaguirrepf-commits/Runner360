import { addDays, computeCompliance, consistency, monthlyTotals, paceSecondsPerKm, weeklyTotals } from "@runner360/training-engine";
import { DISTANCE_LABELS, formatDate, formatDuration, formatKm, formatMinutesLong, formatPaceLabel, formatPercent, todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import { BarChart } from "@/components/charts/bar-chart";
import { Alert, ButtonLink, Card, CardTitle, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { canUseFeature, requireOnboardedSession } from "@/lib/auth";
import { toLogItems } from "@/lib/data/dashboard";
import { loadActivePlan, loadWorkouts } from "@/lib/data/training";

export const metadata: Metadata = { title: "Progreso" };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function ProgressPage() {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const advanced = await canUseFeature(session, "advanced_stats");
  const weeksBack = advanced ? 12 : 4;
  const [workouts, active] = await Promise.all([loadWorkouts(supabase, user.id, advanced ? undefined : addDays(today, -35)), loadActivePlan(supabase, user.id)]);
  const logs = toLogItems(workouts);
  const weekly = weeklyTotals(logs, addDays(today, -(weeksBack - 1) * 7), today);
  const cons = consistency(logs, today, weeksBack);
  const compliance = active ? computeCompliance(active.calendar.map((c) => ({ scheduledDate: c.scheduled_date, status: c.status })), today) : null;
  const weekLabel = (k: string) => `${Number(k.slice(8, 10))}/${Number(k.slice(5, 7))}`;

  if (workouts.length === 0) {
    return (
      <>
        <PageHeader title="Progreso" />
        <Card><EmptyState title="Todavía no hay registros" action={<ButtonLink href="/registrar">Registrar mi primer entrenamiento</ButtonLink>}>Tus gráficos se construyen solo con los entrenamientos que registres.</EmptyState></Card>
      </>
    );
  }

  const { data: prs } = advanced
    ? await supabase.from("personal_records").select("distance_code, finish_time_s, event_date, competition_name").eq("user_id", user.id)
    : { data: null };
  const { data: results } = advanced
    ? await supabase.from("competitions").select("id, name, distance_code, distance_m, event_date, status, competition_results(finish_time_s)").eq("status", "completed").order("event_date")
    : { data: null };

  return (
    <>
      <PageHeader title="Progreso" subtitle="Calculado a partir de tus registros reales." />
      {!advanced ? (
        <div className="mb-4"><Alert tone="info" title="Estadísticas básicas">Ves las últimas 4 semanas. El historial completo, las marcas y la evolución por distancia están incluidos en Premium. <a className="font-semibold underline" href="/suscripcion">Ver Premium</a></Alert></div>
      ) : null}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Cumplimiento del plan" value={formatPercent(compliance?.rate ?? null)} hint={compliance ? `${compliance.completed + compliance.modified}/${compliance.due} sesiones vencidas` : "Sin plan activo"} />
        <Stat label="Consistencia" value={`${cons.activeWeeks}/${cons.weeks}`} hint="semanas con al menos un entrenamiento" />
        <Stat label={`Distancia (${weeksBack} sem.)`} value={formatKm(weekly.reduce((a, w) => a + w.distanceM, 0))} />
        <Stat label={`Tiempo (${weeksBack} sem.)`} value={formatMinutesLong(weekly.reduce((a, w) => a + w.durationS, 0))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Kilómetros por semana</CardTitle>
          <BarChart title="Kilómetros por semana" unitLabel="km, semanas que comienzan el lunes indicado" data={weekly.map((w) => ({ key: w.key, label: weekLabel(w.key), value: w.distanceM, display: formatKm(w.distanceM), highlight: w.key === weekly.at(-1)?.key }))} />
        </Card>
        <Card>
          <CardTitle>Tiempo de entrenamiento por semana</CardTitle>
          <BarChart title="Tiempo por semana" unitLabel="minutos" data={weekly.map((w) => ({ key: w.key, label: weekLabel(w.key), value: w.durationS, display: formatMinutesLong(w.durationS) === "—" ? "0 min" : formatMinutesLong(w.durationS), highlight: w.key === weekly.at(-1)?.key }))} />
        </Card>
        <Card>
          <CardTitle>Sesiones registradas por semana</CardTitle>
          <BarChart title="Sesiones por semana" unitLabel="cantidad" data={weekly.map((w) => ({ key: w.key, label: weekLabel(w.key), value: w.workouts, display: String(w.workouts), highlight: w.key === weekly.at(-1)?.key }))} />
        </Card>
        {advanced ? (
          <Card>
            <CardTitle>Totales mensuales</CardTitle>
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-1">Mes</th><th className="py-1">Distancia</th><th className="py-1">Tiempo</th><th className="py-1">Entrenamientos</th></tr></thead>
              <tbody className="divide-y divide-line">
                {monthlyTotals(logs).slice(-6).reverse().map((m) => (
                  <tr key={m.key}><td className="py-1.5">{MONTHS[Number(m.key.slice(5)) - 1]} {m.key.slice(0, 4)}</td><td className="tabular">{formatKm(m.distanceM)}</td><td className="tabular">{formatMinutesLong(m.durationS)}</td><td className="tabular">{m.workouts}</td></tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}
      </div>
      {advanced ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Marcas personales (resultados reales)</CardTitle>
            {(prs ?? []).length === 0 ? <p className="text-sm text-muted">Cargá resultados en Competencias para ver tus marcas.</p> : (
              <ul className="divide-y divide-line text-sm">
                {(prs as { distance_code: keyof typeof DISTANCE_LABELS; finish_time_s: number; event_date: string; competition_name: string }[]).map((p) => (
                  <li key={p.distance_code} className="flex justify-between py-2"><span>{DISTANCE_LABELS[p.distance_code]} · {p.competition_name}</span><span className="tabular font-semibold">{formatDuration(p.finish_time_s)}</span></li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardTitle>Historial por distancia</CardTitle>
            {(results ?? []).length === 0 ? <p className="text-sm text-muted">Sin competencias finalizadas.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="text-muted"><tr><th className="py-1">Fecha</th><th>Competencia</th><th>Tiempo</th><th>Ritmo</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(results as unknown as { id: string; name: string; distance_m: number; event_date: string; competition_results: { finish_time_s: number }[] | { finish_time_s: number } | null }[]).map((r) => {
                    const res = Array.isArray(r.competition_results) ? r.competition_results[0] : r.competition_results;
                    return (
                      <tr key={r.id}><td className="py-1.5">{formatDate(r.event_date)}</td><td>{r.name} ({formatKm(r.distance_m)})</td><td className="tabular">{res ? formatDuration(res.finish_time_s) : "—"}</td><td className="tabular">{res ? formatPaceLabel(paceSecondsPerKm(r.distance_m, res.finish_time_s)) : "—"}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
