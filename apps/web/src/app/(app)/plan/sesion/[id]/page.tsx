import { formatDate, type ExerciseRow } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionFacts, StatusBadge } from "@/components/app/session-summary";
import { Alert, ButtonLink, Card, CardTitle, DemoBadge, PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";
import { loadActivePlan } from "@/lib/data/training";

export const metadata: Metadata = { title: "Sesión" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireOnboardedSession();
  const active = await loadActivePlan(supabase, user.id);
  const item = active?.calendar.find((c) => c.id === id);
  if (!active || !item) notFound();
  const { data: exercises } = await supabase.from("training_session_exercises").select("*").eq("session_id", item.session.id).order("position");
  const s = item.session;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/plan" className="font-semibold text-navy-700 hover:underline">← Volver al plan</Link></p>
      <PageHeader
        title={s.title}
        subtitle={`${formatDate(item.scheduled_date, "weekday")} · semana ${item.week_number}, sesión ${item.session_number}`}
        actions={item.status === "pending" ? <ButtonLink href={`/registrar?sesion=${item.id}`}>Registrar esta sesión</ButtonLink> : <StatusBadge status={item.status} />}
      />
      {active.version.isDemo ? <div className="mb-4"><DemoBadge label="Sesión DEMO / NO VALIDADA" /></div> : null}
      <div className="space-y-4">
        <Card>
          <CardTitle>Objetivo</CardTitle>
          <p className="text-sm">{s.objective || "—"}</p>
          <div className="mt-4"><SessionFacts session={s} /></div>
        </Card>
        {(exercises ?? []).length > 0 ? (
          <Card>
            <CardTitle>Ejercicios</CardTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-muted"><tr><th className="py-2 pr-4">Ejercicio</th><th className="py-2 pr-4">Series</th><th className="py-2 pr-4">Repeticiones / tiempo</th><th className="py-2">Pausa</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {(exercises as ExerciseRow[]).map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-4 font-medium">{e.name}{e.notes ? <span className="block text-xs text-muted">{e.notes}</span> : null}</td>
                      <td className="py-2 pr-4">{e.sets ?? "—"}</td>
                      <td className="py-2 pr-4">{e.reps ? `${e.reps} rep.` : e.duration_s ? `${e.duration_s} s` : "—"}</td>
                      <td className="py-2">{e.rest_s !== null ? `${e.rest_s} s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
        <Card>
          <CardTitle>Indicaciones</CardTitle>
          <div className="space-y-3 text-sm">
            {s.notes ? <p>{s.notes}</p> : null}
            <div><p className="font-semibold">Criterios de progresión</p><p>{s.progression_criteria || "—"}</p></div>
          </div>
        </Card>
        <Alert tone="warning" title="Cuándo reducir o suspender">{s.stop_criteria || "Ante cualquier molestia inusual, detené la sesión y consultá a un profesional."}</Alert>
      </div>
    </>
  );
}
