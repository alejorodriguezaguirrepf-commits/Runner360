import type { ContentRow } from "@runner360/shared";
import type { Metadata } from "next";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { contentStatusAction } from "@/lib/actions/admin";
import { ContentForm } from "./content-form";

export const metadata: Metadata = { title: "Contenidos" };

export default async function ContentsAdminPage() {
  const { supabase, profile } = await requireAdmin();
  const { data } = await supabase.from("educational_contents").select("*").order("updated_at", { ascending: false });
  const items = (data ?? []) as ContentRow[];
  const statusBtn = (id: string, action: string, label: string) => (
    <form key={action} action={contentStatusAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} /><button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold">{label}</button></form>
  );
  return (
    <>
      <PageHeader title="Contenidos educativos" subtitle="Los contenidos sin revisión profesional se muestran con esa advertencia a los usuarios." />
      <div className="space-y-4">
        {items.map((c) => (
          <Card key={c.id}>
            <CardTitle action={<div className="flex flex-wrap gap-1">
              {c.status !== "published" ? statusBtn(c.id, "publish", "Publicar") : statusBtn(c.id, "draft", "Pasar a borrador")}
              {c.status !== "archived" ? statusBtn(c.id, "archive", "Archivar") : null}
              {!c.reviewed_by && profile.can_validate_plans ? statusBtn(c.id, "review", "Marcar revisado") : null}
            </div>}>
              {c.title}
            </CardTitle>
            <div className="mb-3 flex flex-wrap gap-1">
              <Badge tone={c.status === "published" ? "lime" : "neutral"}>{c.status}</Badge>
              {c.is_premium ? <Badge tone="navy">Premium</Badge> : null}
              {c.reviewed_by ? <Badge tone="success">Revisado</Badge> : <Badge tone="warning">Sin revisión profesional</Badge>}
            </div>
            <details><summary className="cursor-pointer text-sm font-semibold text-navy-700">Editar</summary><ContentForm content={c} /></details>
          </Card>
        ))}
        <Card><CardTitle>Nuevo contenido</CardTitle><ContentForm content={null} /></Card>
      </div>
    </>
  );
}
