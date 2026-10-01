import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { AppRole, Feature } from "@runner360/shared";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export interface Viewer {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
  onboardingCompleted: boolean;
  roles: AppRole[];
  features: Feature[];
}

/** Usuario autenticado y validado contra Supabase Auth (una vez por request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const [{ data: profile }, { data: roles }, { data: features }] = await Promise.all([
    supabase.from("profiles").select("display_name, timezone, onboarding_completed_at").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.rpc("my_features"),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: (profile?.display_name as string | null) ?? null,
    timezone: (profile?.timezone as string | undefined) ?? "America/Argentina/Buenos_Aires",
    onboardingCompleted: Boolean(profile?.onboarding_completed_at),
    roles: ((roles ?? []) as { role: AppRole }[]).map((r) => r.role),
    features: ((features ?? []) as Feature[]),
  };
});

export async function requireViewer(next = "/app"): Promise<Viewer> {
  if (!isSupabaseConfigured()) redirect("/ingresar?motivo=configuracion");
  const viewer = await getViewer();
  if (!viewer) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requireOnboardedViewer(next = "/app"): Promise<Viewer> {
  const viewer = await requireViewer(next);
  if (!viewer.onboardingCompleted) redirect("/onboarding");
  return viewer;
}

export function isAdmin(v: Viewer) {
  return v.roles.includes("admin");
}
export function isStaff(v: Viewer) {
  return v.roles.includes("admin") || v.roles.includes("coach");
}
export function hasFeature(v: Viewer, f: Feature) {
  return v.features.includes(f);
}

/** Acceso al panel: entrenadores y administradores. Las acciones críticas exigen admin. */
export async function requireStaff(): Promise<Viewer> {
  const v = await requireViewer("/admin");
  if (!isStaff(v)) redirect("/app?error=permisos");
  return v;
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await requireViewer("/admin");
  if (!isAdmin(v)) redirect("/admin?error=solo-admin");
  return v;
}
