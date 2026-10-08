import { addDays } from "@runner360/training-engine";
import { formatDate, todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import { SessionFacts } from "@/components/app/session-summary";
import { Card, CardTitle, DemoBadge, PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";
import { loadActivePlan } from "@/lib/data/training";
import { WorkoutForm } from "./workout-form";

export const metadata: Metadata = { title: "Registrar entrenamiento" };

export default async function RegisterWorkoutPage({ searchParams }: { searchParams: Promise<{ sesion?: string }> }) {
  const { supabase, user, profile } = await requireOnboardedSession();
  const { sesion } = await searchParams;
  const today = todayIn(profile.timezone);
  const active = await loadActivePlan(supabase, user.id);
  const from = addDays(today, -14);
  const pending = (active?.calendar ?? []).filter((c) => c.status === "pending" && c.scheduled_date >= from && c.scheduled_date <= today);
  const selected = active?.calendar.find((c) => c.id === sesion && c.status === "pending");
  const options = [...pending];
  if (selected && !options.some((o) => o.id === selected.id)) options.unshift(selected);

  return (
    <>
      <PageHeader title="Registrar entrenamiento" subtitle="Cargá lo que hiciste. Calculamos ritmo y velocidad automáticamente." />
      {selected ? (
        <Card className="mb-4">
          <CardTitle action={active?.version.isDemo ? <DemoBadge /> : null}>Sesión planificada · {formatDate(selected.scheduled_date, "weekday")}</CardTitle>
          <p className="mb-3 font-semibold">{selected.session.title}</p>
          <SessionFacts session={selected.session} compact />
        </Card>
      ) : null}
      <Card>
        <WorkoutForm
          today={today}
          defaultDate={selected && selected.scheduled_date <= today ? selected.scheduled_date : today}
          defaultEntryId={selected?.id ?? ""}
          sessions={options.map((o) => ({ id: o.id, label: `${formatDate(o.scheduled_date)} · ${o.session.title}` }))}
        />
      </Card>
    </>
  );
}
