import type { Metadata } from "next";
import { formatDate, SESSION_TYPE_LABELS } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { WorkoutForm } from "@/components/workouts/workout-form";
import { requireOnboardedViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Registrar entrenamiento" };

function nowLocalInput(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export default async function RegisterWorkoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer("/app/registrar");
  let entry: { id: string; label: string; date: string } | null = null;

  if (sp.sesion && /^[0-9a-f-]{36}$/i.test(sp.sesion)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("user_training_calendar")
      .select("id, scheduled_date, training_sessions(title, session_type)")
      .eq("id", sp.sesion)
      .maybeSingle();
    if (data) {
      const s = data.training_sessions as unknown as { title: string; session_type: keyof typeof SESSION_TYPE_LABELS };
      entry = { id: data.id as string, label: `${s.title} (${SESSION_TYPE_LABELS[s.session_type]}) · ${formatDate(data.scheduled_date as string)}`, date: data.scheduled_date as string };
    }
  }

  const today = nowLocalInput(viewer.timezone);
  const defaultStartedAt = entry && entry.date < today.slice(0, 10) ? `${entry.date}T07:00` : today;

  return (
    <>
      <PageHeader title="Registrar entrenamiento" description="Cargá tu sesión manualmente. El ritmo y la velocidad se calculan automáticamente." />
      <Card>
        <WorkoutForm calendarEntryId={entry?.id ?? null} plannedLabel={entry?.label ?? null} defaultStartedAt={defaultStartedAt} />
      </Card>
    </>
  );
}
