import { FinishSession, type FinishedSession } from "@/components/training/finish-session";
import { OpenWellnessButton } from "@/components/training/wellness-checkin";
import { cx } from "@/components/ui/primitives";
import { WELLNESS_ADVICE, WELLNESS_LEVEL_LABEL, wellnessLevel, type WellnessRow } from "@/lib/wellness";

/**
 * Acciones del entrenamiento de hoy: primero el wellness; con el wellness hecho, "Finalizar sesión"
 * (y, una vez finalizada, el resumen con la opción de corregir).
 */
export function TodayActions({ date, plannedKm, wellness, finished }: { date: string; plannedKm: number | null; wellness: WellnessRow | null; finished: FinishedSession | null }) {
  if (!wellness) {
    return (
      <div className="mt-4 rounded-2xl border border-primary bg-surface-2 p-3">
        <p className="font-bold">Antes de entrenar: wellness de hoy</p>
        <p className="mt-1 text-sm text-muted">Cinco preguntas rápidas sobre cómo llegás. Al completarlo se habilita «Finalizar sesión».</p>
        <OpenWellnessButton className="mt-3 w-full text-base">Completar wellness</OpenWellnessButton>
      </div>
    );
  }
  return <FinishSession date={date} plannedKm={plannedKm} existing={finished} />;
}

const LEVEL_TONE = { great: "text-success", good: "text-success", fair: "text-warning", low: "text-danger" } as const;

/** Resumen del wellness de hoy (arriba del plan), con la opción de corregirlo. */
export function WellnessToday({ wellness }: { wellness: WellnessRow }) {
  const level = wellnessLevel(wellness.score);
  return (
    <section aria-label="Wellness de hoy" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-2 leading-none">
        <span className="tabular text-xl font-extrabold">{wellness.score}</span>
        <span className="text-xs text-muted">/25</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-muted">
          Wellness de hoy · <span className={cx("font-bold", LEVEL_TONE[level])}>{WELLNESS_LEVEL_LABEL[level]}</span>
        </p>
        <p className="text-sm">{WELLNESS_ADVICE[level]}</p>
      </div>
      <OpenWellnessButton variant="ghost">Editar</OpenWellnessButton>
    </section>
  );
}
