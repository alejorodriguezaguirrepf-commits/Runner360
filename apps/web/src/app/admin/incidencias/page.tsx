import { formatDate } from "@runner360/shared";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { incidentStatusAction } from "@/lib/actions/admin";

export const metadata: Metadata = { title: "Incidencias" };

const STATUS = { open: "Abierta", in_progress: "En curso", resolved: "Resuelta" } as const;

export default async function IncidentsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("incident_reports").select("*").order("created_at", { ascending: false }).limit(200);
  const items = (data ?? []) as { id: string; category: string; message: string; page_path: string | null; status: keyof typeof STATUS; admin_notes: string; created_at: string }[];
  return (
    <>
      <PageHeader title="Incidencias y reportes" />
      {items.length === 0 ? <Card><EmptyState title="Sin reportes" /></Card> : (
        <div className="space-y-3">
          {items.map((i) => (
            <Card key={i.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={i.status === "resolved" ? "success" : i.status === "open" ? "warning" : "navy"}>{STATUS[i.status]}</Badge>
                <Badge>{i.category}</Badge>
                <span className="text-muted">{formatDate(i.created_at.slice(0, 10))}{i.page_path ? ` · ${i.page_path}` : ""}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{i.message}</p>
              <form action={incidentStatusAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={i.id} />
                <label className="text-xs font-semibold">Notas internas<input name="adminNotes" defaultValue={i.admin_notes} className="mt-1 block min-h-9 w-72 max-w-full rounded-lg border border-line px-2 text-sm font-normal" /></label>
                <label className="text-xs font-semibold">Estado<select name="status" defaultValue={i.status} className="mt-1 block min-h-9 rounded-lg border border-line px-2 text-sm font-normal">{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <button className="min-h-9 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white">Actualizar</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
