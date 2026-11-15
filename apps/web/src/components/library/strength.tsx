import { PATTERN_LABELS, perSide, PHASE_LABELS, doseLabel } from "@runner360/plan-library";
import { cx } from "@/components/ui/primitives";
import type { StrengthPrescription } from "@/lib/library/strength";

/** Los 5 ejercicios de la sesión con la dosis de la semana y cómo elegir la carga. */
export function StrengthDetail({ p }: { p: StrengthPrescription }) {
  const d = p.dose;
  return (
    <div className="space-y-2">
      {d ? (
        <p className="text-sm">
          <span className="font-semibold">{PHASE_LABELS[d.phase]}:</span> {d.sets} series de {d.reps} repeticiones en cada ejercicio.
          {d.note ? <span className="text-muted"> {d.note}</span> : null}
        </p>
      ) : null}
      <ol className="divide-y divide-line rounded-xl border border-line">
        {p.exercises.map((e, i) => (
          <li key={e.position} className="flex items-start gap-3 px-3 py-2">
            <span aria-hidden className="tabular mt-0.5 w-4 shrink-0 text-sm font-bold text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{e.exercise}</span>
              <span className="block text-xs text-muted">{e.pattern ? PATTERN_LABELS[e.pattern] : e.target}</span>
            </span>
            <span className="tabular shrink-0 text-right text-sm font-bold text-ink">
              {d ? `${d.sets} × ${d.reps}` : e.sets_reps}
              {d && e.pattern && perSide(e.pattern) ? <span className="block text-xs font-normal text-muted">por pierna</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {d ? (
        <p className="text-xs text-muted">
          Elegí un peso con el que completes las {d.reps} repeticiones sabiendo que podrías hacer unas {d.rir} más con buena técnica ({d.rir} en reserva). Pausa
          de 2 a 3 minutos entre series; antes, 1 o 2 series livianas del primer ejercicio.
        </p>
      ) : null}
    </div>
  );
}

/** "Día 1 de fuerza" (o "Fuerza" en el contenido anterior, de rutina única). Nunca el día de la semana. */
export function strengthDayName(p: StrengthPrescription): string {
  return p.dose ? `Día ${p.session} de fuerza` : "Fuerza";
}

/** Fuerza desplegable dentro de un día ("Después: día 1 de fuerza · 4 × 4 · 2 en reserva"). */
export function StrengthBlock({ p, lead, open = false, className }: { p: StrengthPrescription; lead?: string; open?: boolean; className?: string }) {
  const name = strengthDayName(p);
  return (
    <details open={open} className={cx("group rounded-xl border border-line bg-surface-2 text-sm", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="font-semibold">{lead ? `${lead}: ${name.charAt(0).toLowerCase()}${name.slice(1)}` : name}</span>
          {p.dose ? <span className="text-muted"> · {doseLabel(p.dose)}</span> : <span className="text-muted"> · rutina {p.routine}</span>}
        </span>
        <span aria-hidden="true" className="text-muted transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-2">
        <StrengthDetail p={p} />
      </div>
    </details>
  );
}

/** Fuerza de la semana: «Día 1 de fuerza» y «Día 2 de fuerza» (sin días de la semana: cada día del plan dice cuál le toca). */
export function StrengthWeekCard({ sessions }: { sessions: { prescription: StrengthPrescription; dayIndexes: number[] }[] }) {
  if (!sessions.length) return null;
  return (
    <section aria-labelledby="fuerza-semana" className="rounded-2xl border border-line bg-surface p-4">
      <h2 id="fuerza-semana" className="text-lg font-bold">Fuerza de la semana</h2>
      {sessions.some((s) => s.prescription.dose) ? (
        <p className="mt-1 text-sm text-muted">
          5 ejercicios por sesión: dos básicos de piernas (rodilla y cadera), uno auxiliar, un empuje y una tracción. El día 1 de fuerza es el más pesado y el día 2 el más liviano.
        </p>
      ) : null}
      <div className="mt-3 space-y-2">
        {sessions.map(({ prescription }) => (
          <StrengthBlock key={prescription.session} p={prescription} />
        ))}
      </div>
    </section>
  );
}
