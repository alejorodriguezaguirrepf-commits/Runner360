import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireStaff } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/content/categories";
import { createClient } from "@/lib/supabase/server";
import { saveContentAction, setContentStatusAction } from "./actions";

export const metadata: Metadata = { title: "Contenidos" };

type C = { id: string; slug: string; title: string; category: string; summary: string | null; body: string; access_tier: string; status: string };

function ContentForm({ c }: { c?: C }) {
  const k = c?.id ?? "new";
  return (
    <form action={saveContentAction} className="space-y-3">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" htmlFor={`t-${k}`}><Input id={`t-${k}`} name="title" defaultValue={c?.title} required /></Field>
        <Field label="Slug" htmlFor={`s-${k}`}><Input id={`s-${k}`} name="slug" defaultValue={c?.slug} required /></Field>
        <Field label="Categoría" htmlFor={`c-${k}`}><Select id={`c-${k}`} name="category" defaultValue={c?.category ?? "general"}>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Acceso" htmlFor={`a-${k}`}><Select id={`a-${k}`} name="accessTier" defaultValue={c?.access_tier ?? "free"}><option value="free">Gratuito</option><option value="premium">Premium</option></Select></Field>
      </div>
      <Field label="Resumen" htmlFor={`r-${k}`}><Input id={`r-${k}`} name="summary" defaultValue={c?.summary ?? ""} /></Field>
      <Field label="Cuerpo" htmlFor={`b-${k}`} hint="Texto plano. Párrafos separados por línea en blanco; listas con “- ”."><Textarea id={`b-${k}`} name="body" defaultValue={c?.body} className="min-h-40" required /></Field>
      <SubmitButton size="sm">Guardar</SubmitButton>
    </form>
  );
}

export default async function ContentsAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("educational_contents").select("id, slug, title, category, summary, body, access_tier, status").order("updated_at", { ascending: false });
  return (
    <>
      <PageHeader title="Contenidos educativos" />
      {sp.error ? <Alert tone="danger" className="mb-4">{sp.error}</Alert> : null}
      {sp.ok ? <Alert tone="success" className="mb-4">Guardado.</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {((data ?? []) as C[]).map((c) => (
            <details key={c.id} className="rounded-2xl border border-line bg-white p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-semibold text-navy">{c.title}</span>
                <Badge tone={c.status === "published" ? "success" : "neutral"}>{c.status === "published" ? "Publicado" : c.status === "draft" ? "Borrador" : "Archivado"}</Badge>
                {c.access_tier === "premium" ? <Badge tone="lime">Premium</Badge> : null}
              </summary>
              <div className="mt-4 space-y-3">
                <ContentForm c={c} />
                <div className="flex gap-2">
                  {(["published", "draft", "archived"] as const).filter((s) => s !== c.status).map((s) => (
                    <form key={s} action={setContentStatusAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value={s} />
                      <SubmitButton size="sm" variant="secondary" pendingText="…">{s === "published" ? "Publicar" : s === "draft" ? "Pasar a borrador" : "Archivar"}</SubmitButton></form>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
        <Card><CardHeader title="Nuevo contenido" description="Se crea como borrador." /><ContentForm /></Card>
      </div>
    </>
  );
}
