import { todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MonitoringView } from "@/components/training/monitoring-view";
import { PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { loadMonitoring } from "@/lib/data/monitoring";
import { addDaysIso } from "@/lib/monitoring";

export const metadata: Metadata = { title: "Deportista", robots: { index: false, follow: false } };

/** Seguimiento de un deportista: wellness, carga, sesiones y parciales de los últimos 28 días. */
export default async function AthletePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, profile } = await requireAdmin();
  const today = todayIn(profile.timezone);
  const [{ data: person }, monitoring] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("id", id).maybeSingle<{ id: string; display_name: string | null }>(),
    loadMonitoring(supabase, id, addDaysIso(today, -27)),
  ]);
  if (!person) notFound();
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/deportistas" className="font-semibold text-primary-ink hover:underline">← Deportistas</Link></p>
      <PageHeader title={person.display_name || "Deportista"} subtitle="Wellness, sesiones y parciales de los últimos 28 días." />
      <MonitoringView wellness={monitoring.wellness} sessions={monitoring.sessions} today={today} coach />
    </>
  );
}
