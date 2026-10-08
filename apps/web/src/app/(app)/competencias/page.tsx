import { paceSecondsPerKm } from "@runner360/training-engine";
import { COMPETITION_STATUS_LABELS, formatDate, formatDuration, formatKm, formatPaceLabel, todayIn, type CompetitionRow } from "@runner360/shared";
import type { Metadata } from "next";
import { PremiumGate } from "@/components/app/premium-gate";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/primitives";
import { canUseFeature, requireOnboardedSession } from "@/lib/auth";
import { deleteCompetitionAction } from "@/lib/actions/modules";
import { CompetitionForm, PaceCalculator, ResultForm } from "./competition-forms";

export const metadata: Metadata = { title: "Competencias" };

type Row = CompetitionRow & { competition_results: { finish_time_s: number; is_official: boolean } | { finish_time_s: number; is_official: boolean }[] | null };

export default async function CompetitionsPage() {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const allowed = await canUseFeature(session, "competitions");
  const today = todayIn(profile.timezone);
  const calculator = (
    <Card>
      <CardTitle>Calculadora de ritmo y tiempo objetivo</CardTitle>
      <PaceCalculator />
    </Card>
  );
  if (!allowed) {
    return (
      <>
        <PageHeader title="Competencias" />
        <div className="space-y-4"><PremiumGate feature="El registro de competencias" />{calculator}</div>
      </>
    );
  }
  const { data } = await supabase.from("competitions").select("*, competition_results(finish_time_s, is_official)").eq("user_id", user.id).order("event_date", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Competencias" subtitle="Los tiempos objetivo son estimaciones; los resultados son los que informás." />
      <div className="space-y-4">
        <Card>
          <CardTitle>Mis competencias</CardTitle>
          {rows.length === 0 ? <EmptyState title="Sin competencias cargadas" /> : (
            <ul className="divide-y divide-line">
              {rows.map((c) => {
                const res = Array.isArray(c.competition_results) ? c.competition_results[0] : c.competition_results;
                return (
                  <li key={c.id} className="space-y-2 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-muted">{formatDate(c.event_date, "long")} · {formatKm(c.distance_m)}{c.location ? ` · ${c.location}` : ""}</p>
                      </div>
                      <Badge tone={c.status === "completed" ? "success" : c.status === "planned" ? "neutral" : "danger"}>{COMPETITION_STATUS_LABELS[c.status]}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      {c.target_time_s ? <span>Objetivo (estimado): <span className="tabular font-semibold">{formatDuration(c.target_time_s)}</span> · {formatPaceLabel(paceSecondsPerKm(c.distance_m, c.target_time_s))}</span> : null}
                      {res ? <span>Resultado real: <span className="tabular font-semibold">{formatDuration(res.finish_time_s)}</span> · {formatPaceLabel(paceSecondsPerKm(c.distance_m, res.finish_time_s))}{res.is_official ? " · oficial" : ""}</span> : null}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {c.event_date <= today ? (
                        <details className="w-full rounded-xl border border-line p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-navy-700">{res ? "Editar resultado" : "Cargar resultado"}</summary>
                          <ResultForm competitionId={c.id} />
                        </details>
                      ) : null}
                      <form action={deleteCompetitionAction}><input type="hidden" name="id" value={c.id} /><button className="min-h-11 px-2 text-xs font-semibold text-danger">Eliminar</button></form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Nueva competencia</CardTitle>
          <CompetitionForm />
        </Card>
        {calculator}
      </div>
    </>
  );
}
