import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** Exportación de datos personales (derecho de acceso/portabilidad). Solo datos propios vía RLS. */
export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`export:${auth.user.id}`, 5, 60 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const tables = [
    "profiles", "training_profiles", "training_health_info", "user_consents", "user_training_plans", "user_training_calendar",
    "workout_logs", "workout_splits", "hydration_logs", "hydration_reminders", "competitions", "competition_results",
    "competition_result_splits", "subscriptions", "subscription_events", "incident_reports",
  ] as const;
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: auth.user.id, email: auth.user.email };
  for (const t of tables) {
    // Filtro explícito por titular (además de RLS): un administrador exporta solo SUS datos.
    const { data } = await supabase.from(t).select("*").eq(t === "profiles" ? "id" : "user_id", auth.user.id).limit(10_000);
    out[t] = data ?? [];
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="runner360-mis-datos.json"`,
      "cache-control": "no-store",
    },
  });
}
