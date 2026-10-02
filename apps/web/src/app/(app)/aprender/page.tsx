import type { ContentRow } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Aprender" };

const CATEGORY = { hydration: "Hidratación", training: "Entrenamiento", injury_prevention: "Prevención", nutrition: "Nutrición", general: "General" } as const;

export default async function LearnPage() {
  const { supabase } = await requireOnboardedSession();
  const { data } = await supabase.from("educational_contents").select("slug, title, summary, category, is_premium, reviewed_by").eq("status", "published").order("title");
  const items = (data ?? []) as Pick<ContentRow, "slug" | "title" | "summary" | "category" | "is_premium" | "reviewed_by">[];
  return (
    <>
      <PageHeader title="Aprender" subtitle="Contenido educativo general. No reemplaza la consulta profesional." />
      {items.length === 0 ? <EmptyState title="Todavía no hay contenidos publicados" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((c) => (
            <Card key={c.slug}>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge>{CATEGORY[c.category]}</Badge>
                {c.is_premium ? <Badge tone="navy">Premium</Badge> : null}
                {!c.reviewed_by ? <Badge tone="warning">Pendiente de revisión profesional</Badge> : null}
              </div>
              <Link href={`/aprender/${c.slug}`} className="text-lg font-bold hover:underline">{c.title}</Link>
              <p className="mt-1 text-sm text-muted">{c.summary}</p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
