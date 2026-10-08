import "server-only";
import type { ProfileRow } from "@runner360/shared";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClientWithAccessToken } from "@/lib/supabase/server";

export interface ApiSession {
  supabase: SupabaseClient;
  user: User;
  profile: ProfileRow;
}

/**
 * Autenticación de la API v1 (app móvil): `Authorization: Bearer <access_token de Supabase>`.
 * El token se valida contra Supabase Auth y las consultas siguen sujetas a RLS.
 */
export async function authenticateApi(request: Request): Promise<ApiSession | NextResponse> {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = createClientWithAccessToken(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, birth_date, role, can_validate_plans, timezone, onboarding_completed_at, created_at")
    .eq("id", data.user.id)
    .single<ProfileRow>();
  if (!profile) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  return { supabase, user: data.user, profile };
}
