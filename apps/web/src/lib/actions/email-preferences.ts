"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { createPublicClient } from "@/lib/supabase/public";

const token = z.uuid();

/** Baja con el link del correo (sin iniciar sesión): solo con el token del correo. */
export async function unsubscribeByToken(raw: string): Promise<boolean> {
  const t = token.safeParse(raw);
  if (!t.success) return false;
  const db = createPublicClient();
  if (!db) return false;
  const { data, error } = await db.rpc("email_unsubscribe", { p_token: t.data });
  if (error) logError("email:unsubscribe", { code: error.code });
  return data === true;
}

export async function unsubscribeAction(formData: FormData): Promise<{ ok: boolean }> {
  return { ok: await unsubscribeByToken(String(formData.get("t") ?? "")) };
}

/** Perfil: recibir o no los correos de motivación. */
export async function setMotivationalEmailsAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireSession();
  const on = formData.get("motivational") === "on";
  const { error } = await supabase.from("email_preferences").update({ motivational: on }).eq("user_id", user.id);
  if (error) logError("email:preferences", { code: error.code });
  revalidatePath("/perfil");
}
