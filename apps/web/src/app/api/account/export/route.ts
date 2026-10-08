import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Exportación de datos personales (derecho de acceso). Solo datos del titular, vía RLS. */
const TABLES = [
  "profiles",
  "training_profiles",
  "health_screenings",
  "user_consents",
  "user_training_plans",
  "user_training_calendar",
  "workout_logs",
  "workout_splits",
  "hydration_logs",
  "hydration_reminders",
  "competitions",
  "competition_results",
  "competition_splits",
  "subscriptions",
  "subscription_events",
  "incident_reports",
] as const;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const limit = rateLimit(`export:${session.user.id}:${clientKey(request.headers)}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } });

  const data: Record<string, unknown> = {};
  for (const table of TABLES) {
    const column = table === "profiles" ? "id" : "user_id";
    const { data: rows } = await session.supabase.from(table).select("*").eq(column, session.user.id);
    data[table] = rows ?? [];
  }
  const body = JSON.stringify({ exported_at: new Date().toISOString(), email: session.user.email, data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="runner360-mis-datos.json"`,
      "Cache-Control": "no-store",
    },
  });
}
