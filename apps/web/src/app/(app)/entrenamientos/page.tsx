import { paceSecondsPerKm } from "@runner360/training-engine";
import { formatDate, formatDuration, formatKm, formatPaceLabel, WORKOUT_STATUS_LABELS } from "@runner360/shared";
import type { Metadata } from "next";
import { Alert, Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";
import { loadWorkouts } from "@/lib/data/training";
import { DeleteWorkoutButton } from "./delete-button";

export const metadata: Metadata = { title: "Historial" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ guardado?: string }> }) {
  const { supabase, user } = await requireOnboardedSession();
  const { guardado } = await searchParams;
  const workouts = await loadWorkouts(supabase, user.id);
  return (
    <>
      <PageHeader title="Historial de entrenamientos" actions={<ButtonLink href="/registrar">Registrar</ButtonLink>} />
      {guardado ? <div className="mb-4"><Alert tone="success">Entrenamiento guardado.</Alert></div> : null}
      <Card>
        {workouts.length === 0 ? (
          <EmptyState title="Sin entrenamientos registrados">Cuando registres una sesión aparecerá acá.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {workouts.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-28 text-sm font-semibold">{formatDate(w.workout_date)}</div>
                <div className="min-w-0 flex-1 text-sm">
                  {w.status === "skipped" ? (
                    <span className="text-muted">No realizada</span>
                  ) : (
                    <span className="tabular">
                      {formatKm(w.distance_m)} · {w.duration_s ? formatDuration(w.duration_s) : "—"} · {formatPaceLabel(paceSecondsPerKm(w.distance_m ?? 0, w.duration_s ?? 0))}
                      {w.rpe ? ` · RPE ${w.rpe}` : ""}
                    </span>
                  )}
                  {w.comments ? <p className="truncate text-xs text-muted">{w.comments}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {w.calendar_entry_id ? <Badge tone="navy">Del plan</Badge> : null}
                  <Badge tone={w.status === "completed" ? "success" : w.status === "modified" ? "lime" : "danger"}>{WORKOUT_STATUS_LABELS[w.status]}</Badge>
                  {w.pain_reported ? <Badge tone="warning">Dolor reportado</Badge> : null}
                  <DeleteWorkoutButton id={w.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
