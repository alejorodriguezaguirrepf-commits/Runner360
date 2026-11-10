import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { CHALLENGE_COOKIE, CHALLENGE_TTL_S, relyingParty } from "./config";

export type Purpose = "register" | "login";

export function rp() {
  return relyingParty(publicEnv.siteUrl);
}

/** Guarda un desafío de un solo uso y deja su id en una cookie solo para el servidor. */
export async function saveChallenge(admin: SupabaseClient, purpose: Purpose, challenge: string, userId: string | null): Promise<boolean> {
  // De paso se limpian los vencidos (son pocos y de vida corta).
  await admin.from("passkey_challenges").delete().lt("expires_at", new Date().toISOString());
  const { data, error } = await admin
    .from("passkey_challenges")
    .insert({ purpose, challenge, user_id: userId, expires_at: new Date(Date.now() + CHALLENGE_TTL_S * 1000).toISOString() })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return false;
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/passkeys",
    maxAge: CHALLENGE_TTL_S,
  });
  return true;
}

/** Toma (y borra) el desafío de la cookie si es del tipo pedido y no venció. Se puede usar una sola vez. */
export async function takeChallenge(admin: SupabaseClient, purpose: Purpose): Promise<{ challenge: string; user_id: string | null } | null> {
  const store = await cookies();
  const id = store.get(CHALLENGE_COOKIE)?.value;
  store.delete({ name: CHALLENGE_COOKIE, path: "/api/passkeys" });
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin
    .from("passkey_challenges")
    .delete()
    .eq("id", id)
    .eq("purpose", purpose)
    .gt("expires_at", new Date().toISOString())
    .select("challenge, user_id")
    .maybeSingle<{ challenge: string; user_id: string | null }>();
  return data ?? null;
}

export function clientIp(headers: Headers): string {
  return (headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "sin-ip";
}
