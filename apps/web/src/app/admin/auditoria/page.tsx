import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <PageHeader title="Auditoría" description="Últimas 200 acciones administrativas registradas por la base de datos." />
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[800px] text-xs">
          <thead className="bg-surface text-left uppercase text-muted"><tr><th scope="col" className="p-2">Fecha</th><th scope="col">Acción</th><th scope="col">Entidad</th><th scope="col">Actor</th><th scope="col">Detalle</th></tr></thead>
          <tbody className="divide-y divide-line font-mono">
            {(data ?? []).map((a) => (
              <tr key={a.id as number}>
                <td className="p-2">{new Date(a.created_at as string).toLocaleString("es-AR")}</td>
                <td>{a.action as string}</td>
                <td>{a.entity_type as string} {String(a.entity_id ?? "").slice(0, 8)}</td>
                <td>{a.actor_id ? String(a.actor_id).slice(0, 8) : "sistema"}</td>
                <td className="max-w-xs truncate">{JSON.stringify(a.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
