import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { formatDate } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Incidencias" };

const STATUS: Record<string, string> = { open: "Abierta", in_progress: "En curso", resolved: "Resuelta", dismissed: "Descartada" };

async function updateIncidentAction(fd: FormData) {
  "use server";
  await requireAdmin();
  const status = String(fd.get("status") ?? "");
  if (!(status in STATUS)) return;
  const supabase = await createClient();
  await supabase.from("incident_reports").update({ status }).eq("id", String(fd.get("id") ?? ""));
  revalidatePath("/admin/incidencias");
}

export default async function IncidentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: deletions }] = await Promise.all([
    supabase.from("incident_reports").select("id, kind, description, status, created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("account_deletion_requests").select("id, status, created_at").eq("status", "pending"),
  ]);
  return (
    <>
      <PageHeader title="Incidencias y solicitudes" description="Reportes de usuarios. No se muestran datos personales adicionales." />
      {(deletions ?? []).length > 0 ? (
        <p className="mb-4 text-sm"><Badge tone="warning">{deletions!.length} solicitudes de baja pendientes</Badge> Procesarlas con la clave de servicio (ver docs/SECURITY.md).</p>
      ) : null}
      <ul className="space-y-2">
        {(data ?? []).map((i) => (
          <li key={i.id as string} className="rounded-xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge>{i.kind as string}</Badge><Badge tone={i.status === "open" ? "warning" : "neutral"}>{STATUS[i.status as string]}</Badge>
              <span className="text-muted">{formatDate(i.created_at as string)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{i.description as string}</p>
            <form action={updateIncidentAction} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={i.id as string} />
              <label htmlFor={`st-${i.id}`} className="sr-only">Estado</label>
              <Select id={`st-${i.id}`} name="status" defaultValue={i.status as string} className="max-w-[12rem] py-1.5">
                {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <SubmitButton size="sm" variant="secondary" pendingText="…">Actualizar</SubmitButton>
            </form>
          </li>
        ))}
        {(data ?? []).length === 0 ? <li className="text-sm text-muted">Sin incidencias.</li> : null}
      </ul>
    </>
  );
}
