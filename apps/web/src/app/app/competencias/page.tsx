import type { Metadata } from "next";
import { Flag, Trash2 } from "lucide-react";
import { formatDate, formatDuration, formatKm, formatPace } from "@runner360/shared";
import { paceSecondsPerKm, personalBests } from "@runner360/training-engine";
import { PageHeader } from "@/components/app/page-header";
import { CompetitionForm, ResultForm } from "@/components/app/competition-forms";
import { PremiumLocked } from "@/components/premium/locked";
import { PaceCalculator } from "@/components/tools/pace-calculator";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { hasFeature, requireOnboardedViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayKey } from "@/lib/today";
import { deleteCompetitionAction } from "./actions";

export const metadata: Metadata = { title: "Competencias" };

type Row = {
  id: string; name: string; distance_m: number; race_date: string; location: string | null; target_time_s: number | null; status: string;
  competition_results: { finish_time_s: number; notes: string | null } | { finish_time_s: number; notes: string | null }[] | null;
};

export default async function CompetitionsPage() {
  const viewer = await requireOnboardedViewer("/app/competencias");
  const enabled = hasFeature(viewer, "competitions");
  const supabase = await createClient();
  const today = todayKey(viewer.timezone);
  const [{ data }, { data: activePlan }] = await Promise.all([
    supabase.from("competitions").select("id, name, distance_m, race_date, location, target_time_s, status, competition_results(finish_time_s, notes)").eq("user_id", viewer.id).order("race_date", { ascending: false }),
    supabase.from("user_training_plans").select("id").eq("user_id", viewer.id).eq("status", "active").maybeSingle(),
  ]);
  const rows = ((data ?? []) as Row[]).map((r) => ({ ...r, result: Array.isArray(r.competition_results) ? (r.competition_results[0] ?? null) : r.competition_results }));
  const pbs = personalBests(rows.filter((r) => r.result).map((r) => ({ name: r.name, distanceM: r.distance_m, raceDate: r.race_date, finishTimeS: r.result!.finish_time_s })));

  return (
    <>
      <PageHeader title="Competencias" description="Tus objetivos (estimados) y resultados (reales), siempre diferenciados." />
      {!enabled ? <div className="mb-4"><PremiumLocked feature="Competencias" /></div> : null}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <EmptyState icon={Flag} title="Sin competencias registradas">Agregá tu próxima carrera para seguir tu preparación.</EmptyState>
          ) : rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-navy">{r.name}</h2>
                  <p className="text-sm text-muted">{formatKm(r.distance_m, 3)} · {formatDate(r.race_date)}{r.location ? ` · ${r.location}` : ""}</p>
                </div>
                <form action={deleteCompetitionAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton variant="ghost" size="sm" pendingText="…" aria-label={`Eliminar ${r.name}`}><Trash2 className="size-4" aria-hidden /></SubmitButton>
                </form>
              </div>
              <dl className="tabular mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-xs text-muted">Objetivo <Badge>Estimado</Badge></dt>
                  <dd className="font-semibold">{r.target_time_s ? `${formatDuration(r.target_time_s)} · ${formatPace(paceSecondsPerKm(r.distance_m, r.target_time_s))}` : "—"}</dd>
                </div>
                <div className="rounded-lg bg-surface p-3">
                  <dt className="text-xs text-muted">Resultado <Badge tone="success">Real</Badge></dt>
                  <dd className="font-semibold">{r.result ? `${formatDuration(r.result.finish_time_s)} · ${formatPace(paceSecondsPerKm(r.distance_m, r.result.finish_time_s))}` : "Sin registrar"}</dd>
                </div>
              </dl>
              {!r.result && enabled && r.race_date <= today ? (
                <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-navy-600">Registrar resultado</summary><div className="mt-3"><ResultForm competitionId={r.id} /></div></details>
              ) : null}
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {enabled ? (
            <Card><CardHeader title="Nueva competencia" /><CompetitionForm activePlanId={(activePlan?.id as string | undefined) ?? null} /></Card>
          ) : null}
          <Card>
            <CardHeader title="Marcas personales" description="Calculadas solo con resultados reales." />
            {pbs.length === 0 ? <p className="text-sm text-muted">Sin resultados todavía.</p> : (
              <ul className="tabular divide-y divide-line text-sm">
                {pbs.map((p) => <li key={p.distanceM} className="flex justify-between py-2"><span>{formatKm(p.distanceM, 3)}</span><span className="font-semibold">{formatDuration(p.finishTimeS)}</span></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <Card className="mt-6">
        <CardHeader title="Calculadora de ritmo y parciales" description="Estimaciones a ritmo parejo, no garantías de rendimiento." />
        <PaceCalculator />
      </Card>
    </>
  );
}
