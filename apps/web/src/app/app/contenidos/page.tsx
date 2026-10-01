import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedViewer } from "@/lib/auth";
import { CATEGORY_LABELS } from "@/lib/content/categories";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aprender" };


export default async function ContentsPage() {
  await requireOnboardedViewer("/app/contenidos");
  const supabase = await createClient();
  const { data } = await supabase.from("educational_contents").select("slug, title, summary, category, access_tier").eq("status", "published").order("published_at", { ascending: false });
  return (
    <>
      <PageHeader title="Aprender" description="Contenido educativo. No reemplaza la consulta con profesionales." />
      {(data ?? []).length === 0 ? <EmptyState icon={BookOpen} title="Todavía no hay contenidos publicados" /> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(data ?? []).map((c) => (
            <li key={c.slug as string}>
              <Link href={`/app/contenidos/${c.slug}`} className="block h-full rounded-[var(--radius-card)] border border-line bg-white p-5 hover:border-navy/30">
                <div className="flex gap-2"><Badge>{CATEGORY_LABELS[c.category as string] ?? (c.category as string)}</Badge>{c.access_tier === "premium" ? <Badge tone="lime">Premium</Badge> : null}</div>
                <h2 className="mt-3 font-semibold text-navy">{c.title as string}</h2>
                {c.summary ? <p className="mt-1 text-sm text-muted">{c.summary as string}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
