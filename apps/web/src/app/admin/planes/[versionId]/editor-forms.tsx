"use client";

import type { PlanVersion, PlanVersionStatus, Session } from "@runner360/training-engine";
import { INTENSITY_LABELS, SESSION_TYPE_LABELS } from "@runner360/shared";
import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { addVariantAction, importPlanJsonAction, saveSessionAction, updateVersionMetaAction, versionTransitionAction } from "@/lib/actions/admin";

export function MetaForm({ version, changeNotes }: { version: PlanVersion; changeNotes: string }) {
  const [state, action] = useActionState(updateVersionMetaAction, initialActionState);
  const r = version.entryRequirements;
  const p = version.progressionRules;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="versionId" value={version.id} />
      <div className="sm:col-span-2"><TextField label="Nombre" name="name" defaultValue={version.name} /></div>
      <TextField label="Notas del cambio" name="changeNotes" defaultValue={changeNotes} />
      <div className="sm:col-span-3"><TextAreaField label="Objetivo del plan" name="objective" defaultValue={version.objective} rows={2} /></div>
      <TextField label="Semanas (8–24)" name="durationWeeks" type="number" min={8} max={24} defaultValue={version.durationWeeks} />
      <TextField label="Sesiones por semana" name="sessionsPerWeek" type="number" min={1} max={7} defaultValue={version.sessionsPerWeek} />
      <span />
      <TextField label="Requisito: km semanales mínimos" name="minWeeklyKm" type="number" min={0} defaultValue={r.minWeeklyKm} />
      <TextField label="Requisito: meses de experiencia" name="minExperienceMonths" type="number" min={0} defaultValue={r.minExperienceMonths} />
      <TextField label="Requisito: edad mínima" name="minAge" type="number" min={13} defaultValue={r.minAge} />
      <div className="sm:col-span-3"><TextField label="Notas de requisitos" name="requirementNotes" defaultValue={r.notes} /></div>
      <TextField label="Cumplimiento para avanzar (%)" name="minComplianceToAdvance" type="number" min={0} max={100} defaultValue={Math.round(p.minComplianceToAdvance * 100)} />
      <TextField label="Repetir semana por debajo de (%)" name="repeatWeekBelowCompliance" type="number" min={0} max={100} defaultValue={Math.round(p.repeatWeekBelowCompliance * 100)} />
      <TextField label="Revisión si RPE medio supera" name="reviewAboveAvgRpe" type="number" step="0.5" min={1} max={10} defaultValue={p.reviewAboveAvgRpe} />
      <TextField label="Aumento máx. de volumen semanal (%)" name="maxWeeklyVolumeIncreasePct" type="number" min={0} max={100} defaultValue={p.maxWeeklyVolumeIncreasePct} />
      <div className="sm:col-span-3"><FormMessage state={state} /><SubmitButton variant="secondary">Guardar datos</SubmitButton></div>
    </form>
  );
}

export function SessionEditor({ versionId, weekNumber, sessionNumber, session }: { versionId: string; weekNumber: number; sessionNumber: number; session: Session | null }) {
  const [state, action] = useActionState(saveSessionAction, initialActionState);
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-xs font-semibold text-navy-700">{session ? "Editar" : "Cargar sesión"}</summary>
      <form action={action} className="mt-3 grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="versionId" value={versionId} />
        <input type="hidden" name="weekNumber" value={weekNumber} />
        <input type="hidden" name="sessionNumber" value={sessionNumber} />
        <SelectField label="Tipo" name="type" defaultValue={session?.type ?? "easy_run"} options={Object.entries(SESSION_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <TextField label="Título" name="title" defaultValue={session?.title ?? ""} />
        <SelectField label="Intensidad" name="intensity" defaultValue={session?.intensity ?? "low"} options={Object.entries(INTENSITY_LABELS).map(([value, label]) => ({ value, label }))} />
        <TextField label="Duración (min)" name="durationMin" type="number" min={1} defaultValue={session?.durationS ? Math.round(session.durationS / 60) : ""} />
        <TextField label="Distancia (km)" name="distanceKm" type="number" step="0.1" min={0} defaultValue={session?.distanceM ? session.distanceM / 1000 : ""} />
        <TextField label="RPE mín." name="rpeMin" type="number" min={1} max={10} defaultValue={session?.rpeMin ?? ""} />
        <TextField label="RPE máx." name="rpeMax" type="number" min={1} max={10} defaultValue={session?.rpeMax ?? ""} />
        <TextField label="Objetivo" name="objective" defaultValue={session?.objective ?? ""} />
        <div className="sm:col-span-2"><TextAreaField label="Entrada en calor" name="warmup" rows={2} defaultValue={session?.warmup ?? ""} /></div>
        <div className="sm:col-span-2"><TextAreaField label="Parte principal" name="mainSet" rows={2} defaultValue={session?.mainSet ?? ""} /></div>
        <div className="sm:col-span-2"><TextAreaField label="Vuelta a la calma" name="cooldown" rows={2} defaultValue={session?.cooldown ?? ""} /></div>
        <div className="sm:col-span-2"><TextAreaField label="Indicaciones" name="notes" rows={2} defaultValue={session?.notes ?? ""} /></div>
        <div className="sm:col-span-2"><TextAreaField label="Criterios de progresión" name="progressionCriteria" rows={2} defaultValue={session?.progressionCriteria ?? ""} /></div>
        <div className="sm:col-span-2"><TextAreaField label="Criterios para reducir o suspender" name="stopCriteria" rows={2} defaultValue={session?.stopCriteria ?? ""} /></div>
        <div className="sm:col-span-4"><FormMessage state={state} /><SubmitButton variant="secondary">Guardar sesión</SubmitButton></div>
      </form>
    </details>
  );
}

export function VariantForm({ versionId }: { versionId: string }) {
  const [state, action] = useActionState(addVariantAction, initialActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      <input type="hidden" name="versionId" value={versionId} />
      <TextField label="Código" name="code" placeholder="v3-a" />
      <TextField label="Etiqueta" name="label" placeholder="Mar · Jue · Sáb" />
      <TextField label="Días (1–7)" name="weekdays" placeholder="2,4,6" />
      <TextField label="Prioridad" name="priority" type="number" min={0} defaultValue={0} />
      <SubmitButton variant="secondary">Agregar</SubmitButton>
      <div className="sm:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}

export function ImportJsonForm({ versionId }: { versionId: string }) {
  const [state, action] = useActionState(importPlanJsonAction, initialActionState);
  return (
    <form action={action} className="space-y-3" onSubmit={(e) => { if (!window.confirm("Se reemplazarán semanas, sesiones y variantes de este borrador. ¿Continuar?")) e.preventDefault(); }}>
      <input type="hidden" name="versionId" value={versionId} />
      <TextAreaField label="JSON con weeks, sessions y scheduleVariants (formato del motor, ver docs/TRAINING_ENGINE.md)" name="json" rows={6} />
      <FormMessage state={state} />
      <SubmitButton variant="ghost">Importar</SubmitButton>
    </form>
  );
}

export function TransitionButtons({ versionId, status, canValidate, isDemo, validated }: { versionId: string; status: PlanVersionStatus; canValidate: boolean; isDemo: boolean; validated: boolean }) {
  const [state, action] = useActionState(versionTransitionAction, initialActionState);
  const btn = (to: string, label: string, variant: "primary" | "secondary" | "ghost" | "danger" = "secondary", confirmText?: string) => (
    <form key={to} action={action} onSubmit={(e) => { if (confirmText && !window.confirm(confirmText)) e.preventDefault(); }}>
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton variant={variant} pendingText="Procesando…">{label}</SubmitButton>
    </form>
  );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? btn("in_review", "Enviar a revisión") : null}
        {status === "in_review" ? btn("draft", "Devolver a borrador", "ghost") : null}
        {status === "in_review" && !isDemo && canValidate && !validated ? btn("sign_off", "Firmar validación profesional", "secondary", "Confirmás que revisaste y validás profesionalmente esta versión.") : null}
        {status === "in_review" ? btn("published", "Publicar", "primary", "La versión publicada no podrá editarse y reemplazará a la anterior para nuevas inscripciones. ¿Publicar?") : null}
        {status === "published" ? btn("archived", "Archivar", "danger", "Los usuarios inscriptos conservan su versión. ¿Archivar?") : null}
        {btn("clone", "Crear nueva versión desde esta", "ghost")}
      </div>
      <FormMessage state={state} />
    </div>
  );
}
