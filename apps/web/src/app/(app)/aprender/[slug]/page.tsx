import type { ContentRow } from "@runner360/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireOnboardedSession();
  const { data } = await supabase.from("educational_contents").select("*").eq("slug", slug).eq("status", "published").maybeSingle<ContentRow>();
  if (!data) notFound();
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/aprender" className="font-semibold text-navy-700 hover:underline">← Aprender</Link></p>
      <PageHeader title={data.title} subtitle={data.summary} />
      {!data.reviewed_by ? <div className="mb-4"><Alert tone="warning" title="Pendiente de revisión profesional">Este contenido es orientativo y todavía no fue revisado por el equipo profesional.</Alert></div> : null}
      <Card><Markdown source={data.body} /></Card>
    </>
  );
}
