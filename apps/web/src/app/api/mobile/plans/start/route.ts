import { NextResponse } from "next/server";
import { startPlanForUser } from "@/lib/data/start-plan";
import { rateLimit } from "@/lib/rate-limit";
import { createClientFromBearer } from "@/lib/supabase/bearer";

/**
 * API para la app móvil: inicia el plan sugerido con el mismo motor que la web.
 * Autenticación: Authorization: Bearer <access_token de Supabase>. RLS aplica con la identidad del usuario.
 */
export async function POST(request: Request) {
  const auth = await createClientFromBearer(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`mobile-start:${auth.user.id}`, 10, 60 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { choice?: string };
  const choice = body.choice === "introductory" ? "introductory" : "recommended";
  const [{ data: profile }, { data: features }] = await Promise.all([
    auth.client.from("profiles").select("timezone").eq("id", auth.user.id).maybeSingle(),
    auth.client.rpc("my_features"),
  ]);
  const result = await startPlanForUser(
    auth.client,
    {
      id: auth.user.id,
      timezone: (profile?.timezone as string | undefined) ?? "America/Argentina/Buenos_Aires",
      premiumPlans: ((features ?? []) as string[]).includes("premium_plans"),
    },
    choice,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
