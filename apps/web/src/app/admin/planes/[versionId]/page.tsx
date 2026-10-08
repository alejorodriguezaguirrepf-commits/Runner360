import { validatePlanVersion } from "@runner360/training-engine";
import { PLAN_STATUS_LABELS, SESSION_TYPE_LABELS, formatDate, formatMinutesLong, type PlanVersionRow } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardTitle, DemoBadge, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { deleteSessionAction, deleteVariantAction } from "@/lib/actions/admin";
import { loadPlanVersions } from "@/lib/data/training";
import { ImportJsonForm, MetaForm, SessionEditor, TransitionButtons, VariantForm } from "./editor-forms";

export const metadata: Metadata = { title: "Editar versión de plan" };

export default async function VersionEditorPage({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const { supabase, profile } = await requireAdmin();
  const [version] = await loadPlanVersions(supabase, [versionId]);
  if (!version) notFound();
  const { data: row } = await supabase.from("training_plan_versions").select("*").eq("id", versionId).single<PlanVersionRow & { validation_notes: string }>();
  if (!row) notFound();
  const { data: sessionIds } = await supabase.from("training_sessions").select("id, week_number, session_number").eq("version_id", versionId);
  const idOf = new Map(((sessionIds ?? []) as { id: string; week_number: number; session_number: number }[]).map((s) => [`${s.week_number}:${s.session_number}`, s.id]));
  const check = validatePlanVersion(version);
  const editable = version.status === "draft";
  const errors = check.issues.filter((i) => i.severity === "error");
  const warnings = check.issues.filter((i) => i.severity === "warning");

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/planes" className="font-semibold text-navy-700 hover:underline">← Planes</Link></p>
      <PageHeader
        title={`${version.name} · v${version.versionNumber}`}
        subtitle={row.change_notes || undefined}
        actions={<div className="flex flex-wrap gap-2">{version.isDemo ? <DemoBadge /> : null}<Badge tone="navy">{PLAN_STATUS_LABELS[version.status]}</Badge></div>}
      />
      <div className="space-y-4">
        <Card>
          <CardTitle>Validación y ciclo de vida</CardTitle>
          {errors.length === 0 ? (
            <Alert tone="success" title="Estructura válida">{warnings.length ? `${warnings.length} advertencia(s) para revisar.` : "Sin advertencias."}</Alert>
          ) : (
            <Alert tone="danger" title={`${errors.length} error(es) bloquean la publicación`}>
              <ul className="ml-4 list-disc">{errors.slice(0, 12).map((i, n) => <li key={n}>{i.message}</li>)}</ul>
              {errors.length > 12 ? <p>… y {errors.length - 12} más.</p> : null}
            </Alert>
          )}
          {warnings.length > 0 ? (
            <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Ver advertencias</summary><ul className="ml-4 mt-2 list-disc">{warnings.map((i, n) => <li key={n}>{i.message}</li>)}</ul></details>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            {row.validated_at ? `Validada el ${formatDate(row.validated_at.slice(0, 10), "long")}. ${row.validation_notes}` : version.isDemo ? "Versión DEMO: no requiere validación profesional, pero se muestra siempre como NO VALIDADA." : "Requiere validación profesional (firma) antes de publicarse."}
          </p>
          <div className="mt-4"><TransitionButtons versionId={versionId} status={version.status} canValidate={profile.can_validate_plans} isDemo={version.isDemo} validated={Boolean(row.validated_at)} /></div>
        </Card>

        {editable ? (
          <>
            <Card><CardTitle>Datos de la versión</CardTitle><MetaForm version={version} changeNotes={row.change_notes} /></Card>
            <Card>
              <CardTitle>Variantes de distribución semanal</CardTitle>
              <p className="mb-3 text-sm text-muted">Cada variante asigna un día (1 = lunes … 7 = domingo) a cada sesión. El motor nunca inventa distribuciones: si no hay una compatible con el usuario, informa que se necesita configuración profesional.</p>
              <ul className="mb-3 divide-y divide-line text-sm">
                {version.scheduleVariants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2">
                    <span><span className="font-mono">{v.code}</span> · {v.label} · días [{v.weekdays.join(", ")}] · prioridad {v.priority}</span>
                    <form action={deleteVariantAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="versionId" value={versionId} /><button className="text-xs font-semibold text-danger">Quitar</button></form>
                  </li>
                ))}
              </ul>
              <VariantForm versionId={versionId} />
            </Card>
          </>
        ) : (
          <Alert tone="info" title="Versión de solo lectura">Las versiones en revisión, publicadas o archivadas no se modifican. Para hacer cambios, creá una nueva versión desde esta.</Alert>
        )}

        <Card>
          <CardTitle>Sesiones ({version.sessions.length} de {version.durationWeeks * version.sessionsPerWeek})</CardTitle>
          <div className="space-y-3">
            {Array.from({ length: version.durationWeeks }, (_, w) => w + 1).map((week) => (
              <details key={week} className="rounded-xl border border-line p-3">
                <summary className="cursor-pointer font-semibold">
                  Semana {week} {version.weeks.find((x) => x.weekNumber === week)?.focus ? `· ${version.weeks.find((x) => x.weekNumber === week)?.focus}` : ""}
                  <span className="ml-2 text-xs font-normal text-muted">{version.sessions.filter((s) => s.weekNumber === week).length}/{version.sessionsPerWeek} sesiones</span>
                </summary>
                <div className="mt-3 space-y-3">
                  {Array.from({ length: version.sessionsPerWeek }, (_, n) => n + 1).map((num) => {
                    const s = version.sessions.find((x) => x.weekNumber === week && x.sessionNumber === num);
                    const id = idOf.get(`${week}:${num}`);
                    return (
                      <div key={num} className="rounded-lg bg-canvas p-3">
                        <p className="text-sm font-semibold">Sesión {num}: {s ? `${s.title} · ${SESSION_TYPE_LABELS[s.type]} · ${s.durationS ? formatMinutesLong(s.durationS) : ""}` : <span className="text-danger">sin cargar</span>}</p>
                        {editable ? (
                          <div className="mt-2 flex flex-wrap items-start gap-2">
                            <SessionEditor versionId={versionId} weekNumber={week} sessionNumber={num} session={s ?? null} />
                            {id ? <form action={deleteSessionAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="versionId" value={versionId} /><button className="min-h-9 text-xs font-semibold text-danger">Eliminar</button></form> : null}
                          </div>
                        ) : s ? <p className="mt-1 text-xs text-muted">{s.mainSet}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </Card>

        {editable ? <Card><CardTitle>Importar contenido (JSON)</CardTitle><ImportJsonForm versionId={versionId} /></Card> : null}
      </div>
    </>
  );
}
