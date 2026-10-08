import { DISTANCE_LABELS, LEVEL_LABELS, PLAN_STATUS_LABELS, type PlanRow, type PlanVersionRow } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardTitle, DemoBadge, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { NewPlanForm } from "./new-plan-form";

export const metadata: Metadata = { title: "Planes" };

export default async function PlansAdminPage() {
  const { supabase } = await requireAdmin();
  const [{ data: plans }, { data: versions }] = await Promise.all([
    supabase.from("training_plans").select("*").order("distance").order("level"),
    supabase.from("training_plan_versions").select("id, plan_id, version_number, status, is_demo, validated_at, published_at, name").order("version_number", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title="Planes de entrenamiento" subtitle="Solo se publican versiones que cumplen los criterios de validación. Una versión publicada no se edita: se crea una nueva." />
      <div className="space-y-4">
        {((plans ?? []) as PlanRow[]).map((p) => (
          <Card key={p.id}>
            <CardTitle action={<span className="text-xs text-muted">{DISTANCE_LABELS[p.distance]} · {LEVEL_LABELS[p.level]} · {p.is_premium ? "Premium" : "Gratis"}</span>}>{p.name}</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {((versions ?? []) as PlanVersionRow[]).filter((v) => v.plan_id === p.id).map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/planes/${v.id}`} className="font-semibold text-navy-700 hover:underline">Versión {v.version_number}</Link>
                  <span className="flex flex-wrap gap-1">
                    {v.is_demo ? <DemoBadge /> : v.validated_at ? <Badge tone="success">Validada</Badge> : <Badge tone="warning">Sin validar</Badge>}
                    <Badge tone={v.status === "published" ? "lime" : v.status === "archived" ? "neutral" : "navy"}>{PLAN_STATUS_LABELS[v.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card>
          <CardTitle>Nuevo plan</CardTitle>
          <NewPlanForm />
        </Card>
      </div>
    </>
  );
}
