import type { Metadata } from "next";
import { Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage() {
  const { supabase } = await requireAdmin();
  const [{ data: logs }, { data: events }] = await Promise.all([
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("payment_events").select("id, provider, event_type, received_at, processed_at, processing_error").order("received_at", { ascending: false }).limit(50),
  ]);
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Últimas 100 acciones administrativas y 50 eventos de pago." />
      <div className="space-y-4">
        <Card className="overflow-x-auto">
          <CardTitle>Acciones</CardTitle>
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted"><tr><th className="py-1">Fecha</th><th>Acción</th><th>Entidad</th><th>Actor</th><th>Detalle</th></tr></thead>
            <tbody className="divide-y divide-line">
              {((logs ?? []) as { id: number; created_at: string; action: string; entity_type: string; entity_id: string | null; actor_id: string | null; metadata: unknown }[]).map((l) => (
                <tr key={l.id}><td className="py-1.5">{new Date(l.created_at).toLocaleString("es-AR")}</td><td className="font-semibold">{l.action}</td><td>{l.entity_type} <span className="font-mono">{l.entity_id?.slice(0, 8)}</span></td><td className="font-mono">{l.actor_id?.slice(0, 8) ?? "sistema"}</td><td className="font-mono">{JSON.stringify(l.metadata)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="overflow-x-auto">
          <CardTitle>Eventos de pago</CardTitle>
          {(events ?? []).length === 0 ? <p className="text-sm text-muted">Sin eventos recibidos.</p> : (
            <table className="w-full text-left text-xs">
              <thead className="text-muted"><tr><th className="py-1">Recibido</th><th>Proveedor</th><th>Tipo</th><th>Estado</th></tr></thead>
              <tbody className="divide-y divide-line">
                {((events ?? []) as { id: string; provider: string; event_type: string; received_at: string; processed_at: string | null; processing_error: string | null }[]).map((e) => (
                  <tr key={e.id}><td className="py-1.5">{new Date(e.received_at).toLocaleString("es-AR")}</td><td>{e.provider}</td><td>{e.event_type}</td><td className={e.processing_error ? "text-danger" : ""}>{e.processing_error ?? (e.processed_at ? "Procesado" : "Pendiente")}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
