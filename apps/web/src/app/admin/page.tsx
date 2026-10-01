import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Stat } from "@/components/ui/card";
import { isAdmin, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administración" };

const LABELS: Record<string, string> = {
  users_total: "Usuarios", users_last_30d: "Altas últimos 30 días", onboarded: "Perfiles completos",
  active_subscriptions: "Suscripciones activas", active_plans: "Planes activos", workouts_last_30d: "Entrenamientos (30 días)",
  published_versions: "Versiones publicadas", open_incidents: "Incidencias abiertas", pending_deletions: "Bajas pendientes",
};

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireStaff();
  const supabase = await createClient();
  const stats = isAdmin(viewer) ? (await supabase.rpc("admin_business_stats")).data as Record<string, number> | null : null;
  return (
    <>
      <PageHeader title="Panel administrativo" description="Métricas agregadas, sin datos personales." />
      {sp.error === "solo-admin" ? <Alert tone="danger" className="mb-4">Esa sección es exclusiva de administradores.</Alert> : null}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {Object.entries(LABELS).map(([k, label]) => <Stat key={k} label={label} value={(stats[k] ?? 0).toLocaleString("es-AR")} />)}
        </div>
      ) : (
        <Alert>Como entrenador podés gestionar planes y contenidos. Las métricas del negocio son exclusivas de administradores.</Alert>
      )}
    </>
  );
}
