import type { Metadata } from "next";
import { Alert, Card, CardTitle, PageHeader, Stat } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/env.server";
import { PROVIDERS } from "@/lib/payments/registry";

export const metadata: Metadata = { title: "Administración" };

const LABELS: Record<string, string> = {
  users_total: "Usuarios",
  users_onboarded: "Con perfil completo",
  users_last_30d: "Altas (30 días)",
  premium_active: "Premium activos",
  active_plans: "Planes activos",
  workouts_last_30d: "Entrenamientos (30 días)",
  open_incidents: "Incidencias abiertas",
  payment_events_failed: "Eventos de pago con error",
};

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const { data: stats, error } = await supabase.rpc("admin_business_stats");
  return (
    <>
      <PageHeader title="Resumen del negocio" subtitle="Métricas agregadas, sin datos personales." />
      {error ? <Alert tone="danger">No se pudieron cargar las estadísticas.</Alert> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(LABELS).map(([k, label]) => <Stat key={k} label={label} value={String((stats as Record<string, number> | null)?.[k] ?? 0)} />)}
        </div>
      )}
      <Card className="mt-6">
        <CardTitle>Estado de integraciones</CardTitle>
        <ul className="space-y-2 text-sm">
          {Object.values(PROVIDERS).map((p) => (
            <li key={p.id} className="flex justify-between"><span>{p.label}</span><span className={p.isConfigured() ? "text-success" : "text-warning"}>{p.isConfigured() ? "Configurado" : "Pendiente de configuración"}</span></li>
          ))}
          <li className="flex justify-between"><span>Compras en apps (App Store / Google Play)</span><span className="text-warning">Pendiente de configuración</span></li>
          <li className="flex justify-between"><span>Clave de servicio (eliminación de cuentas, webhooks)</span><span className={isServiceRoleConfigured() ? "text-success" : "text-warning"}>{isServiceRoleConfigured() ? "Configurada" : "Pendiente de configuración"}</span></li>
        </ul>
      </Card>
    </>
  );
}
