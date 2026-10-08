import { NextResponse } from "next/server";
import { authenticateApi } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApi(request);
  if (auth instanceof NextResponse) return auth;
  const { data: premium } = await auth.supabase.rpc("has_premium", { p_user: auth.user.id });
  return NextResponse.json({
    id: auth.user.id,
    displayName: auth.profile.display_name,
    role: auth.profile.role,
    timezone: auth.profile.timezone,
    onboardingCompleted: Boolean(auth.profile.onboarding_completed_at),
    premium: premium === true,
  });
}
