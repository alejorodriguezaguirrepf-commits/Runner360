import { BarChart } from "@/components/charts/bar-chart";
import { Card, CardTitle, cx, Stat } from "@/components/ui/primitives";
import { formatClock } from "@/lib/calculator";
import type { MonitoredSession } from "@/lib/data/monitoring";
import { acuteChronic, addDaysIso, LOAD_STATUS_LABEL, loadStatus, weeklyLoads } from "@/lib/monitoring";
import { paceSPerKm, RPE_LABELS, sessionLoad } from "@/lib/session-finish";
import { averageScore, WELLNESS_ITEMS, WELLNESS_KEYS, WELLNESS_LEVEL_LABEL, wellnessLevel, type WellnessRow } from "@/lib/wellness";

const dayLabel = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const longDay = (d: string) =>
  new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const km = (m: number) => (m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const pace = (s: number | null) => (s ? `${formatClock(s)}/km` : "—");
const LEVEL_TONE = { great: "text-success", good: "text-success", fair: "text-warning", low: "text-danger" } as const;

/**
 * Seguimiento de una persona: wellness diario, carga de las sesiones (RPE × minutos) y parciales.
 * Lo ve la persona en Progreso y su entrenador en Administración → Deportistas.
 */
export function MonitoringView({ wellness, sessions, today, coach = false }: { wellness: WellnessRow[]; sessions: MonitoredSession[]; today: string; coach?: boolean }) {
  const last7 = wellness.filter((w) => w.check_date > addDaysIso(today, -7));
  const latest = wellness.at(-1) ?? null;
  const ac = acuteChronic(sessions, today);
  const status = loadStatus(ac.ratio);
  const weeks = weeklyLoads(sessions, today, 6);
  const withRpe = sessions.filter((s) => s.rpe);
  const avgRpe = withRpe.length ? Math.round((withRpe.reduce((a, s) => a + s.rpe!, 0) / withRpe.length) * 10) / 10 : null;
  const days = Array.from({ length: 14 }, (_, i) => addDaysIso(today, i - 13));
  const byDate = new Map(wellness.map((w) => [w.check_date, w]));
  const who = coach ? "" : "tu ";

  if (!wellness.length && !sessions.length) {
    return (
      <Card>
        <CardTitle>Wellness y carga</CardTitle>
        <p className="text-sm text-muted">
          {coach
            ? "Todavía no hay wellness ni sesiones finalizadas."
            : "Cuando completes el wellness antes de entrenar y finalices tus sesiones con parciales y RPE, acá vas a ver tu recuperación y tu carga."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Último wellness"
          value={latest ? <span className={LEVEL_TONE[wellnessLevel(latest.score)]}>{latest.score}/25</span> : "—"}
          hint={latest ? `${WELLNESS_LEVEL_LABEL[wellnessLevel(latest.score)]} · ${latest.check_date === today ? "hoy" : longDay(latest.check_date)}` : "Sin respuestas"}
        />
        <Stat label="Wellness (7 días)" value={averageScore(last7)?.toLocaleString("es-AR") ?? "—"} hint={`promedio de ${last7.length} ${last7.length === 1 ? "día" : "días"}`} />
        <Stat label="Carga (7 días)" value={ac.acute || "—"} hint={status ? `${LOAD_STATUS_LABEL[status]} frente a ${who}promedio (${ac.chronic}/sem.)` : "RPE × minutos"} />
        <Stat label="RPE medio" value={avgRpe?.toLocaleString("es-AR") ?? "—"} hint={`${sessions.length} ${sessions.length === 1 ? "sesión" : "sesiones"} (28 días)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Wellness diario (14 días)</CardTitle>
          <BarChart
            title="Wellness diario"
            unitLabel="puntaje de 5 a 25"
            data={days.map((d) => {
              const w = byDate.get(d);
              return { key: d, label: dayLabel(d), value: w?.score ?? 0, display: w ? `${w.score}/25` : "sin respuesta", highlight: d === today };
            })}
          />
        </Card>
        <Card>
          <CardTitle>Carga semanal (RPE × minutos)</CardTitle>
          <BarChart
            title="Carga semanal"
            unitLabel="carga, semanas que comienzan el lunes indicado"
            data={weeks.map((w, i) => ({ key: w.key, label: dayLabel(w.key), value: w.load, display: `${w.load} (${w.count} ses.)`, highlight: i === weeks.length - 1 }))}
          />
        </Card>
      </div>

      {wellness.length ? (
        <Card>
          <CardTitle>Detalle del wellness</CardTitle>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Detalle del wellness">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-1.5 pr-3">Día</th>
                  {WELLNESS_KEYS.map((k) => (
                    <th key={k} scope="col" className="py-1.5 pr-3">{WELLNESS_ITEMS[k].short}</th>
                  ))}
                  <th scope="col" className="py-1.5">Total</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line">
                {[...wellness].reverse().slice(0, 14).map((w) => (
                  <tr key={w.check_date} className="align-top">
                    <th scope="row" className="py-1.5 pr-3 font-semibold">
                      {longDay(w.check_date)}
                      {w.note ? <span className="block max-w-56 text-xs font-normal text-muted">“{w.note}”</span> : null}
                    </th>
                    {WELLNESS_KEYS.map((k) => (
                      <td key={k} className={cx("py-1.5 pr-3", w[k] <= 2 && "font-bold text-danger")} title={WELLNESS_ITEMS[k].options[w[k] - 1]}>
                        {w[k]}
                      </td>
                    ))}
                    <td className={cx("py-1.5 font-bold", LEVEL_TONE[wellnessLevel(w.score)])}>{w.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Cada ítem va de 1 (peor) a 5 (mejor). En rojo, los valores de 1 o 2.</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Sesiones y parciales</CardTitle>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">Todavía no hay sesiones registradas.</p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const load = sessionLoad(s.rpe, s.duration_s);
              const avg = s.distance_m && s.duration_s ? paceSPerKm(s.distance_m, s.duration_s) : null;
              return (
                <li key={s.id}>
                  <details className="group rounded-xl border border-line">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{longDay(s.workout_date)}</span>
                        <span className="tabular block text-sm text-muted">
                          {s.distance_m ? `${km(s.distance_m)} km` : "—"} · {s.duration_s ? formatClock(s.duration_s) : "—"} · {pace(avg)}
                          {load ? ` · carga ${load}` : ""}
                        </span>
                      </span>
                      <span className="tabular shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold" title={s.rpe ? RPE_LABELS[s.rpe] : undefined}>
                        RPE {s.rpe ?? "—"}
                      </span>
                      <span aria-hidden className="text-muted transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="border-t border-line px-3 py-2">
                      {s.splits.length ? (
                        <table className="tabular w-full max-w-sm text-left text-sm">
                          <thead className="text-muted">
                            <tr>
                              <th scope="col" className="py-1 pr-3">Parcial</th>
                              <th scope="col" className="py-1 pr-3">Tiempo</th>
                              <th scope="col" className="py-1">Ritmo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {s.splits.map((p, i) => {
                              const pp = paceSPerKm(p.meters, p.seconds);
                              const diff = pp && avg ? Math.round(pp - avg) : null;
                              return (
                                <tr key={i}>
                                  <th scope="row" className="py-1 pr-3 font-semibold">{i + 1}. {p.meters >= 1000 ? `${km(p.meters)} km` : `${p.meters} m`}</th>
                                  <td className="py-1 pr-3">{formatClock(p.seconds)}</td>
                                  <td className="py-1">
                                    {pace(pp)}
                                    {diff !== null && Math.abs(diff) >= 3 ? (
                                      <span className={cx("ml-2 text-xs", diff < 0 ? "text-success" : "text-warning")}>
                                        {diff < 0 ? "−" : "+"}
                                        {Math.abs(diff)}&quot;
                                      </span>
                                    ) : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-muted">Sin parciales cargados.</p>
                      )}
                      {s.comments ? <p className="mt-2 text-sm text-muted">“{s.comments}”</p> : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
