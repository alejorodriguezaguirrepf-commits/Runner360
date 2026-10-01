import type { Metadata } from "next";
import { Activity, Trash2 } from "lucide-react";
import { formatDate, formatDuration, formatKm, formatPace, WORKOUT_STATUS_LABELS } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedViewer } from "@/lib/auth";
import { loadWorkouts } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { deleteWorkoutAction } from "../registrar/actions";

export const metadata: Metadata = { title: "Historial" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer("/app/historial");
  const supabase = await createClient();
  const workouts = await loadWorkouts(supabase, viewer.id, undefined, 200);

  return (
    <>
      <PageHeader title="Historial" description="Tus entrenamientos registrados, del más reciente al más antiguo." action={<ButtonLink href="/app/registrar">Registrar</ButtonLink>} />
      {sp.guardado ? <Alert tone="success" className="mb-4">Entrenamiento guardado.</Alert> : null}
      {sp.eliminado ? <Alert className="mb-4">Registro eliminado.</Alert> : null}
      {workouts.length === 0 ? (
        <EmptyState icon={Activity} title="Todavía no registraste entrenamientos" action={<ButtonLink href="/app/registrar">Registrar el primero</ButtonLink>}>
          Cada registro alimenta tus estadísticas y el cumplimiento de tu plan.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-white p-4">
              <div className="min-w-32">
                <p className="font-semibold text-navy">{formatDate(w.started_at, { weekday: "short", timeZone: viewer.timezone })}</p>
                <Badge tone={w.status === "completed" ? "success" : w.status === "modified" ? "lime" : "danger"}>{WORKOUT_STATUS_LABELS[w.status]}</Badge>
              </div>
              <dl className="tabular grid flex-1 grid-cols-3 gap-2 text-sm">
                <div><dt className="text-xs text-muted">Distancia</dt><dd className="font-semibold">{formatKm(w.distance_m)}</dd></div>
                <div><dt className="text-xs text-muted">Duración</dt><dd className="font-semibold">{formatDuration(w.duration_s)}</dd></div>
                <div><dt className="text-xs text-muted">Ritmo</dt><dd className="font-semibold">{formatPace(w.avg_pace_s_per_km == null ? null : Number(w.avg_pace_s_per_km))}</dd></div>
              </dl>
              <form action={deleteWorkoutAction}>
                <input type="hidden" name="id" value={w.id} />
                <SubmitButton variant="ghost" size="sm" pendingText="…" aria-label={`Eliminar registro del ${formatDate(w.started_at, { timeZone: viewer.timezone })}`}>
                  <Trash2 className="size-4" aria-hidden />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
