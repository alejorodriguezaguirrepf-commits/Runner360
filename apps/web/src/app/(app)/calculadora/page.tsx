import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireOnboardedSession } from "@/lib/auth";
import { PaceCalculator } from "./pace-calculator";

export const metadata: Metadata = { title: "Test/%" };

export default async function CalculatorPage() {
  const { supabase, user } = await requireOnboardedSession();
  const { data } = await supabase
    .from("user_pace_tests")
    .select("distance_m, time_s, updated_at")
    .eq("user_id", user.id)
    .maybeSingle<{ distance_m: number; time_s: number; updated_at: string }>();
  return (
    <>
      <PageHeader
        title="Test/%"
        subtitle="Cargá tu test y te calculamos los parciales del 50 % al 100 % en cada distancia. El 100 % es el ritmo de tu test; el porcentaje es sobre la velocidad."
      />
      <PaceCalculator initial={data ? { meters: data.distance_m, seconds: data.time_s, savedAt: data.updated_at } : null} />
    </>
  );
}
