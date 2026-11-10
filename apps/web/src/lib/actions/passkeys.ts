"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logError } from "@/lib/log";

/** Quita el ingreso con huella de un dispositivo (la base solo deja borrar las llaves propias). */
export async function removePasskeyAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireSession();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { error } = await supabase.from("passkeys").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) logError("passkeys:remove", error);
  else await supabase.rpc("write_audit_log", { p_action: "passkey.removed", p_entity_type: "profile", p_entity_id: user.id, p_metadata: {} });
  revalidatePath("/perfil");
}
