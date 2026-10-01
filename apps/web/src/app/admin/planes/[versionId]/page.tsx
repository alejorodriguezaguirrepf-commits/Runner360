import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { formatDuration, INTENSITIES, INTENSITY_LABELS, SESSION_TYPE_LABELS, SESSION_TYPES } from "@runner360/shared";
import { canPublish, isEditable, STATUS_TRANSITIONS, validatePlanVersion, type PlanSession } from "@runner360/training-engine";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, DemoBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { isAdmin, requireStaff } from "@/lib/auth";
import { loadFullVersion } from "@/lib/data/plans";
import { createClient } from "@/lib/supabase/server";
import { addWeekAction, cloneVersionAction, deleteSessionAction, deleteWeekAction, saveSessionAction, transitionAction, updateVersionMetaAction } from "../actions";

export const metadata: Metadata = { title: "Editar versión de plan" };

const STATUS_LABELS: Record<string, string> = { draft: "Borrador", in_review: "En revisión", approved: "Aprobada", published: "Publicada", archived: "Archivada" };
const ACTION_LABELS: Record<string, string> = { in_review: "Enviar a revisión", draft: "Volver a borrador", approved: "Aprobar", published: "Publicar", archived: "Archivar" };

function SessionFields({ s, editable }: { s?: PlanSession; editable: boolean }) {
  const k = s?.id ?? "new";
  return (
    <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-4">
      <Field label="N.º" htmlFor={`n-${k}`}><Input id={`n-${k}`} name="sessionNumber" type="number" min={1} max={14} defaultValue={s?.sessionNumber ?? 1} /></Field>
      <Field label="Día (orden)" htmlFor={`d-${k}`}><Input id={`d-${k}`} name="daySlot" type="number" min={1} max={7} defaultValue={s?.daySlot ?? 1} /></Field>
      <Field label="Tipo" htmlFor={`t-${k}`}><Select id={`t-${k}`} name="type" defaultValue={s?.type ?? "easy_run"}>{SESSION_TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>)}</Select></Field>
      <Field label="Intensidad" htmlFor={`i-${k}`}><Select id={`i-${k}`} name="intensity" defaultValue={s?.intensity ?? "easy"}>{INTENSITIES.map((t) => <option key={t} value={t}>{INTENSITY_LABELS[t]}</option>)}</Select></Field>
      <Field label="Título" htmlFor={`ti-${k}`} className="sm:col-span-2"><Input id={`ti-${k}`} name="title" defaultValue={s?.title ?? ""} required /></Field>
      <Field label="Duración" htmlFor={`du-${k}`} hint="min o h:mm:ss"><Input id={`du-${k}`} name="duration" defaultValue={s?.durationS ? formatDuration(s.durationS) : ""} /></Field>
      <Field label="Distancia (km)" htmlFor={`di-${k}`}><Input id={`di-${k}`} name="distanceKm" defaultValue={s?.distanceM ? String(s.distanceM / 1000).replace(".", ",") : ""} /></Field>
      <Field label="RPE mín." htmlFor={`r1-${k}`}><Input id={`r1-${k}`} name="rpeMin" type="number" min={1} max={10} defaultValue={s?.rpeMin ?? ""} /></Field>
      <Field label="RPE máx." htmlFor={`r2-${k}`}><Input id={`r2-${k}`} name="rpeMax" type="number" min={1} max={10} defaultValue={s?.rpeMax ?? ""} /></Field>
      <Field label="Objetivo" htmlFor={`o-${k}`} className="sm:col-span-2"><Input id={`o-${k}`} name="objective" defaultValue={s?.objective ?? ""} /></Field>
      <Field label="Calentamiento" htmlFor={`w-${k}`} className="sm:col-span-2"><Textarea id={`w-${k}`} name="warmup" defaultValue={s?.warmup ?? ""} className="min-h-16" /></Field>
      <Field label="Parte principal" htmlFor={`m-${k}`} className="sm:col-span-2"><Textarea id={`m-${k}`} name="mainSet" defaultValue={s?.mainSet ?? ""} className="min-h-16" /></Field>
      <Field label="Vuelta a la calma" htmlFor={`c-${k}`} className="sm:col-span-2"><Textarea id={`c-${k}`} name="cooldown" defaultValue={s?.cooldown ?? ""} className="min-h-16" /></Field>
      <Field label="Indicaciones" htmlFor={`no-${k}`} className="sm:col-span-2"><Textarea id={`no-${k}`} name="notes" defaultValue={s?.notes ?? ""} className="min-h-16" /></Field>
    </fieldset>
  );
}

export default async function VersionEditor({ params, searchParams }: { params: Promise<{ versionId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { versionId } = await params;
  const sp = await searchParams;
  const viewer = await requireStaff();
  const supabase = await createClient();
  const v = await loadFullVersion(supabase, versionId);
  if (!v) notFound();
  const editable = isEditable(v.status);
  const validation = validatePlanVersion(v);
  const publish = canPublish({ ...v, status: "approved" });
  const admin = isAdmin(viewer);

  return (
    <>
      <Link href="/admin/planes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600"><ArrowLeft className="size-4" aria-hidden /> Planes</Link>
      <PageHeader
        title={`${v.name} · v${v.version}`}
        description={editable ? "Versión en borrador: editable." : "Versión no editable. Para cambiarla, creá una versión nueva."}
        action={<div className="flex gap-2"><Badge tone="navy">{STATUS_LABELS[v.status]}</Badge>{v.isDemo ? <DemoBadge /> : <Badge tone={v.validationStatus === "validated" ? "success" : "warning"}>{v.validationStatus === "validated" ? "Validada" : "Pendiente de validación"}</Badge>}</div>}
      />
      {sp.error ? <Alert tone="danger" className="mb-4">{sp.error}</Alert> : null}
      {sp.ok ? <Alert tone="success" className="mb-4">Cambios guardados.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Datos de la versión" />
            <form action={updateVersionMetaAction} className="space-y-3">
              <input type="hidden" name="versionId" value={v.id} />
              <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-3">
                <Field label="Nombre" htmlFor="name" className="sm:col-span-3"><Input id="name" name="name" defaultValue={v.name} /></Field>
                <Field label="Semanas" htmlFor="durationWeeks"><Input id="durationWeeks" name="durationWeeks" type="number" defaultValue={v.durationWeeks} /></Field>
                <Field label="Sesiones/semana" htmlFor="sessionsPerWeek"><Input id="sessionsPerWeek" name="sessionsPerWeek" type="number" defaultValue={v.sessionsPerWeek} /></Field>
                <div className="flex items-end pb-2"><Checkbox id="requiresPremium" name="requiresPremium" defaultChecked={v.requiresPremium} label="Requiere Premium" /></div>
                <Field label="Objetivo del plan" htmlFor="objective" className="sm:col-span-3"><Textarea id="objective" name="objective" defaultValue={v.objective} /></Field>
                <Field label="Requisito: km/semana" htmlFor="minWeeklyKm"><Input id="minWeeklyKm" name="minWeeklyKm" defaultValue={String(v.entryRequirements.minWeeklyDistanceM / 1000).replace(".", ",")} /></Field>
                <Field label="Requisito: meses" htmlFor="minExperienceMonths"><Input id="minExperienceMonths" name="minExperienceMonths" type="number" defaultValue={v.entryRequirements.minExperienceMonths} /></Field>
                <div className="flex items-end pb-2"><Checkbox id="requiresHealthClearance" name="requiresHealthClearance" defaultChecked={v.entryRequirements.requiresHealthClearance} label="Antecedentes → revisión profesional" /></div>
                <Field label="Notas de ingreso" htmlFor="entryNotes" className="sm:col-span-3"><Input id="entryNotes" name="entryNotes" defaultValue={v.entryRequirements.notes} /></Field>
                <Field label="Criterios de progresión" htmlFor="progressionCriteria" className="sm:col-span-3"><Textarea id="progressionCriteria" name="progressionCriteria" defaultValue={v.progressionCriteria} /></Field>
                <Field label="Criterios para reducir o suspender" htmlFor="reduceOrStopCriteria" className="sm:col-span-3"><Textarea id="reduceOrStopCriteria" name="reduceOrStopCriteria" defaultValue={v.reduceOrStopCriteria} /></Field>
                <Field label="Cumplimiento mínimo (0-1)" htmlFor="minWeeklyCompliance"><Input id="minWeeklyCompliance" name="minWeeklyCompliance" defaultValue={v.progressionRules.minWeeklyCompliance} /></Field>
                <Field label="Aumento máx. de carga %" htmlFor="maxWeeklyLoadIncreasePct"><Input id="maxWeeklyLoadIncreasePct" name="maxWeeklyLoadIncreasePct" defaultValue={v.progressionRules.maxWeeklyLoadIncreasePct} /></Field>
                <Field label="Semanas omitibles" htmlFor="maxSkippableWeeks"><Input id="maxSkippableWeeks" name="maxSkippableWeeks" type="number" defaultValue={v.progressionRules.maxSkippableWeeks} /></Field>
                <Field label="Margen RPE alerta" htmlFor="rpeOverTargetMargin"><Input id="rpeOverTargetMargin" name="rpeOverTargetMargin" type="number" defaultValue={v.progressionRules.rpeOverTargetMargin} /></Field>
                <Field label="Sesiones RPE alerta" htmlFor="rpeOverTargetSessions"><Input id="rpeOverTargetSessions" name="rpeOverTargetSessions" type="number" defaultValue={v.progressionRules.rpeOverTargetSessions} /></Field>
                <Field label="Variantes de días validadas (JSON)" htmlFor="scheduleVariants" className="sm:col-span-3" hint='[{"id":"3d","label":"…","weekdayPatterns":[[2,4,6]]}] · días ISO: 1 = lunes'>
                  <Textarea id="scheduleVariants" name="scheduleVariants" className="font-mono text-xs" defaultValue={JSON.stringify(v.scheduleVariants, null, 1)} />
                </Field>
              </fieldset>
              {editable ? <SubmitButton>Guardar datos</SubmitButton> : null}
            </form>
          </Card>

          {v.weeks.map((w) => (
            <details key={w.id} className="rounded-2xl border border-line bg-white">
              <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
                <span className="font-semibold text-navy">Semana {w.weekNumber} <span className="font-normal text-muted">· {w.focus || "sin foco"} · {w.sessions.length} sesiones</span></span>
              </summary>
              <div className="space-y-4 px-4 pb-4">
                {w.sessions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line p-3">
                    <form action={saveSessionAction} className="space-y-3">
                      <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="sessionId" value={s.id} />
                      <SessionFields s={s} editable={editable} />
                      {editable ? <SubmitButton size="sm">Guardar sesión</SubmitButton> : null}
                    </form>
                    {editable ? (
                      <form action={deleteSessionAction} className="mt-2">
                        <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="sessionId" value={s.id} />
                        <SubmitButton size="sm" variant="ghost" pendingText="…"><Trash2 className="size-4" aria-hidden /> Eliminar sesión</SubmitButton>
                      </form>
                    ) : null}
                  </div>
                ))}
                {editable ? (
                  <>
                    <details className="rounded-xl bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-navy">Agregar sesión</summary>
                      <form action={saveSessionAction} className="mt-3 space-y-3">
                        <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="weekId" value={w.id} />
                        <SessionFields editable />
                        <SubmitButton size="sm">Agregar</SubmitButton>
                      </form>
                    </details>
                    <form action={deleteWeekAction}>
                      <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="weekId" value={w.id} />
                      <SubmitButton size="sm" variant="ghost" pendingText="…">Eliminar semana</SubmitButton>
                    </form>
                  </>
                ) : null}
              </div>
            </details>
          ))}
          {editable ? (
            <form action={addWeekAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="versionId" value={v.id} />
              <Field label="Foco de la nueva semana" htmlFor="focus"><Input id="focus" name="focus" /></Field>
              <SubmitButton variant="secondary">Agregar semana</SubmitButton>
            </form>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Validación estructural" description="Reglas deterministas del motor de entrenamiento." />
            {validation.errors.length === 0 ? <Alert tone="success">Sin errores.</Alert> : (
              <ul className="space-y-1 text-sm text-danger">{validation.errors.map((e, i) => <li key={i}>• {e.message}</li>)}</ul>
            )}
            {validation.warnings.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-warning">{validation.warnings.map((e, i) => <li key={i}>⚠ {e.message}</li>)}</ul>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Flujo de publicación" />
            <div className="space-y-3">
              {STATUS_TRANSITIONS[v.status].map((to) => {
                const adminOnly = to === "published" || to === "archived";
                if (adminOnly && !admin) return <p key={to} className="text-sm text-muted">{ACTION_LABELS[to]}: solo administradores.</p>;
                return (
                  <form key={to} action={transitionAction} className="space-y-2 rounded-xl bg-surface p-3">
                    <input type="hidden" name="versionId" value={v.id} /><input type="hidden" name="to" value={to} />
                    {to === "approved" && !v.isDemo ? (
                      <Checkbox id="professionalValidation" name="professionalValidation" label="Confirmo que el contenido fue revisado y validado profesionalmente" />
                    ) : null}
                    {to === "approved" || to === "draft" ? <Field label="Notas de revisión" htmlFor={`rn-${to}`}><Textarea id={`rn-${to}`} name="reviewerNotes" className="min-h-16" /></Field> : null}
                    {to === "published" && !publish.allowed ? <ul className="text-xs text-danger">{publish.reasons.map((r) => <li key={r}>• {r}</li>)}</ul> : null}
                    <SubmitButton size="sm" variant={to === "published" ? "primary" : "secondary"} disabled={to === "published" && !publish.allowed}>{ACTION_LABELS[to]}</SubmitButton>
                  </form>
                );
              })}
              {STATUS_TRANSITIONS[v.status].length === 0 ? <p className="text-sm text-muted">Versión archivada.</p> : null}
            </div>
            <form action={cloneVersionAction} className="mt-4 border-t border-line pt-4">
              <input type="hidden" name="versionId" value={v.id} />
              <SubmitButton variant="secondary" size="sm">Crear nueva versión (borrador) a partir de esta</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
