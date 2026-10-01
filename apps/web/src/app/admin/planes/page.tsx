import type { Metadata } from "next";
import Link from "next/link";
import { RACE_DISTANCE_LABELS, RACE_DISTANCES, RUNNER_LEVEL_LABELS, RUNNER_LEVELS, type RaceDistance, type RunnerLevel } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPlanAction } from "./actions";

export const metadata: Metadata = { title: "Planes" };

const STATUS_LABELS: Record<string, string> = { draft: "Borrador", in_review: "En revisión", approved: "Aprobada", published: "Publicada", archived: "Archivada" };

type P = { id: string; slug: string; kind: string; target_distance: RaceDistance; level: RunnerLevel; is_demo: boolean; training_plan_versions: { id: string; version: number; name: string; status: string; validation_status: string }[] };

export default async function PlansAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("training_plans").select("id, slug, kind, target_distance, level, is_demo, training_plan_versions(id, version, name, status, validation_status)").order("target_distance").order("level");
  const plans = (data ?? []) as P[];
  return (
    <>
      <PageHeader title="Planes de entrenamiento" description="Cada modificación de un plan publicado se hace en una versión nueva: el historial de los usuarios no se altera." />
      {sp.error ? <Alert tone="danger" className="mb-4">{sp.error}</Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase text-muted"><tr><th scope="col" className="p-3">Plan</th><th scope="col">Versiones</th></tr></thead>
            <tbody className="divide-y divide-line">
              {plans.map((p) => (
                <tr key={p.id} className="align-top">
                  <td className="p-3">
                    <p className="font-medium">{RACE_DISTANCE_LABELS[p.target_distance]} · {RUNNER_LEVEL_LABELS[p.level]}</p>
                    <p className="text-xs text-muted">{p.slug} · {p.kind === "introductory" ? "Introductorio" : "Estándar"}</p>
                    {p.is_demo ? <Badge tone="warning" className="mt-1">DEMO</Badge> : null}
                  </td>
                  <td className="py-3 pr-3">
                    <ul className="space-y-1">
                      {[...p.training_plan_versions].sort((a, b) => b.version - a.version).map((v) => (
                        <li key={v.id}>
                          <Link href={`/admin/planes/${v.id}`} className="font-medium text-navy-600 underline">v{v.version}</Link>{" "}
                          <Badge tone={v.status === "published" ? "success" : v.status === "draft" ? "neutral" : "lime"}>{STATUS_LABELS[v.status]}</Badge>{" "}
                          <span className="text-xs text-muted">{v.validation_status === "validated" ? "Validada" : v.validation_status === "demo_unvalidated" ? "No validada (DEMO)" : "Pendiente de revisión"}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card>
          <CardHeader title="Nuevo plan" description="Se crea con una versión 1 en borrador." />
          <form action={createPlanAction} className="space-y-3">
            <Field label="Nombre" htmlFor="name"><Input id="name" name="name" required /></Field>
            <Field label="Identificador (slug)" htmlFor="slug" hint="minúsculas-y-guiones"><Input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Distancia" htmlFor="targetDistance"><Select id="targetDistance" name="targetDistance">{RACE_DISTANCES.map((d) => <option key={d} value={d}>{RACE_DISTANCE_LABELS[d]}</option>)}</Select></Field>
              <Field label="Nivel" htmlFor="level"><Select id="level" name="level">{RUNNER_LEVELS.map((l) => <option key={l} value={l}>{RUNNER_LEVEL_LABELS[l]}</option>)}</Select></Field>
              <Field label="Tipo" htmlFor="kind"><Select id="kind" name="kind"><option value="standard">Estándar</option><option value="introductory">Introductorio</option></Select></Field>
              <Field label="Semanas" htmlFor="durationWeeks"><Input id="durationWeeks" name="durationWeeks" type="number" min={1} max={52} defaultValue={12} /></Field>
              <Field label="Sesiones por semana" htmlFor="sessionsPerWeek"><Input id="sessionsPerWeek" name="sessionsPerWeek" type="number" min={1} max={7} defaultValue={3} /></Field>
            </div>
            <Checkbox id="isDemo" name="isDemo" label="Es un plan de demostración (se mostrará como DEMO / NO VALIDADO)" />
            <SubmitButton>Crear plan</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
