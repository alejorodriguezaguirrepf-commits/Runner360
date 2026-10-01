import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireOnboardedViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Renderiza texto plano con párrafos y listas simples ("- "). Sin HTML arbitrario (evita XSS). */
function PlainBody({ body }: { body: string }) {
  const blocks = body.split(/\n{2,}/);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
        }
        return <p key={i}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOnboardedViewer("/app/contenidos");
  const supabase = await createClient();
  const { data } = await supabase.from("educational_contents").select("title, summary, body").eq("slug", slug).eq("status", "published").maybeSingle();
  if (!data) notFound();
  return (
    <>
      <Link href="/app/contenidos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-navy-600"><ArrowLeft className="size-4" aria-hidden /> Volver</Link>
      <PageHeader title={data.title as string} description={data.summary as string | undefined} />
      <Card className="max-w-3xl"><PlainBody body={data.body as string} /></Card>
    </>
  );
}
