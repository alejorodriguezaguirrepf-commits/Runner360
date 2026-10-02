import "server-only";
import type { ProfileRow } from "@runner360/shared";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface Session {
  supabase: SupabaseClient;
  user: User;
  profile: ProfileRow;
}

/** Usuario autenticado validado contra Supabase Auth, o null. Cacheado por request. */
export const getSession = cache(async (): Promise<Session | null> => {
  // Marca la ruta como dinámica (depende de cookies) incluso sin Supabase configurado.
  await cookies();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, birth_date, role, can_validate_plans, timezone, onboarding_completed_at, created_at")
    .eq("id", user.id)
    .single<ProfileRow>();
  if (!profile) return null;
  return { supabase, user, profile };
});

export async function requireSession(nextPath?: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(nextPath ? `/ingresar?next=${encodeURIComponent(nextPath)}` : "/ingresar");
  return session;
}

/** Sesión con onboarding completo; si no, envía al cuestionario. */
export async function requireOnboardedSession(): Promise<Session> {
  const session = await requireSession();
  if (!session.profile.onboarding_completed_at) redirect("/onboarding");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession("/admin");
  if (session.profile.role !== "admin") redirect("/inicio");
  return session;
}

export async function hasPremium(session: Session): Promise<boolean> {
  const { data } = await session.supabase.rpc("has_premium", { p_user: session.user.id });
  return data === true;
}

export async function canUseFeature(session: Session, feature: string): Promise<boolean> {
  const { data } = await session.supabase.rpc("can_use_feature", { p_feature: feature });
  return data === true;
}
