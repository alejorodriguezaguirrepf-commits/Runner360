import { CALENDAR_STATUS_LABELS, formatKm, formatMinutesLong, INTENSITY_LABELS, SESSION_TYPE_LABELS, type CalendarStatusDb, type SessionRow } from "@runner360/shared";
import { Badge } from "@/components/ui/primitives";

export function sessionVolumeLabel(s: Pick<SessionRow, "distance_m" | "duration_s" | "session_type">): string {
  if (s.session_type === "rest") return "Descanso";
  const parts = [];
  if (s.distance_m) parts.push(formatKm(s.distance_m));
  if (s.duration_s) parts.push(formatMinutesLong(s.duration_s));
  return parts.join(" · ") || "—";
}

export function rpeLabel(s: Pick<SessionRow, "rpe_min" | "rpe_max">): string | null {
  if (s.rpe_min === null && s.rpe_max === null) return null;
  if (s.rpe_min !== null && s.rpe_max !== null && s.rpe_min !== s.rpe_max) return `RPE ${s.rpe_min}–${s.rpe_max}`;
  return `RPE ${s.rpe_min ?? s.rpe_max}`;
}

const STATUS_TONE: Record<CalendarStatusDb, "neutral" | "success" | "lime" | "danger"> = {
  pending: "neutral",
  completed: "success",
  modified: "lime",
  skipped: "danger",
};

export function StatusBadge({ status }: { status: CalendarStatusDb }) {
  return <Badge tone={STATUS_TONE[status]}>{CALENDAR_STATUS_LABELS[status]}</Badge>;
}

/** Ficha compacta de sesión: objetivo, volumen, intensidad y estructura. */
export function SessionFacts({ session, compact = false }: { session: SessionRow; compact?: boolean }) {
  const rpe = rpeLabel(session);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge tone="navy">{SESSION_TYPE_LABELS[session.session_type]}</Badge>
        <Badge>{sessionVolumeLabel(session)}</Badge>
        <Badge>Intensidad {INTENSITY_LABELS[session.intensity].toLowerCase()}</Badge>
        {rpe ? <Badge tone="lime">{rpe}</Badge> : null}
      </div>
      {!compact ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-muted">Entrada en calor</dt>
            <dd>{session.warmup || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">Parte principal</dt>
            <dd>{session.main_set || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">Vuelta a la calma</dt>
            <dd>{session.cooldown || "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
