import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Débito automático que todavía puede cobrar (suscripción activa, en prueba o en gracia, sin cancelar
 * la renovación). Mientras exista, la persona no puede eliminar su cuenta: primero lo cancela.
 */
export async function activeAutoDebit(supabase: SupabaseClient, userId: string): Promise<{ provider: string } | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("provider")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .neq("provider", "manual")
    .eq("cancel_at_period_end", false)
    .limit(1)
    .maybeSingle<{ provider: string }>();
  return data ?? null;
}
