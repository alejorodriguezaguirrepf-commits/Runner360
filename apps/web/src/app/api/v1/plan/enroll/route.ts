import { todayIn } from "@runner360/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApi } from "@/lib/api-auth";
import { evaluateEnrollment, loadTrainingProfile } from "@/lib/data/training";
import { enrollmentMessage } from "@/lib/enrollment-messages";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({ versionId: z.uuid().optional(), dryRun: z.boolean().default(false) });

/**
 * Asignación de plan para la app móvil. Usa exactamente la misma lógica (motor + persistencia)
 * que la web, para no duplicar reglas de negocio en Dart.
 */
export async function POST(request: Request) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;
  const limit = rateLimit(`enroll:${auth.user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const tp = await loadTrainingProfile(auth.supabase, auth.user.id, auth.profile.birth_date);
  if (!tp) return NextResponse.json({ error: "onboarding_required" }, { status: 409 });
  const { data: premium } = await auth.supabase.rpc("has_premium", { p_user: auth.user.id });
  const outcome = await evaluateEnrollment({
    supabase: auth.supabase,
    userId: auth.user.id,
    profile: tp.profile,
    today: todayIn(auth.profile.timezone),
    hasPremium: premium === true,
    versionId: body.data.versionId,
    commit: !body.data.dryRun,
  });
  if (outcome.kind === "enrolled") {
    return NextResponse.json({
      kind: "enrolled",
      dryRun: body.data.dryRun,
      userPlanId: outcome.userPlanId || null,
      versionId: outcome.result.version.id,
      versionName: outcome.result.version.name,
      isDemo: outcome.result.version.isDemo,
      startDate: outcome.result.startDate,
      startWeek: outcome.result.startWeek,
      sessions: outcome.result.calendar.length,
    });
  }
  const msg = enrollmentMessage(outcome);
  return NextResponse.json({ kind: outcome.kind, title: msg.title, message: msg.text }, { status: 422 });
}
