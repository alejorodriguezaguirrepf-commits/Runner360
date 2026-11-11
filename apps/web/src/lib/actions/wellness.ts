"use server";

import { todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedSession } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";
import { wellnessLevel, type WellnessLevel } from "@/lib/wellness";

const item = z.number().int().min(1).max(5);
const schema = z.object({
  sleep: item,
  energy: item,
  soreness: item,
  stress: item,
  mood: item,
  note: z.string().trim().max(300).optional(),
  consent: z.boolean().optional(),
});
export type WellnessInput = z.input<typeof schema>;
export type WellnessResult = { ok: true; score: number; level: WellnessLevel } | { ok: false; message: string; needsConsent?: boolean };

/**
 * Wellness del día (fecha local de la persona). Es un dato de salud: sin consentimiento vigente se
 * pide que lo acepte (y se registra). Se puede corregir en el mismo día: uno por fecha.
 */
export async function saveWellnessAction(input: WellnessInput): Promise<WellnessResult> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Respondé las cinco preguntas." };
  const v = parsed.data;

  const { data: consent } = await supabase.rpc("has_consent", { p_user: user.id, p_type: "health_data" });
  if (consent !== true) {
    if (!v.consent) return { ok: false, needsConsent: true, message: "Para guardar tu bienestar necesitamos tu consentimiento." };
    const { error } = await supabase
      .from("user_consents")
      .insert({ user_id: user.id, consent_type: "health_data", document_version: LEGAL_VERSIONS.health_data, granted: true });
    if (error) {
      logError("wellness:consent", { code: error.code });
      return { ok: false, message: "No pudimos guardar. Probá nuevamente." };
    }
  }

  const row = {
    user_id: user.id,
    check_date: todayIn(profile.timezone),
    sleep: v.sleep,
    energy: v.energy,
    soreness: v.soreness,
    stress: v.stress,
    mood: v.mood,
    note: v.note || null,
  };
  const { data, error } = await supabase
    .from("wellness_checkins")
    .upsert(row, { onConflict: "user_id,check_date" })
    .select("score")
    .single<{ score: number }>();
  if (error || !data) {
    // Sin detalles: son datos de salud.
    logError("wellness:save", { code: error?.code });
    return { ok: false, message: "No pudimos guardar. Probá nuevamente." };
  }
  revalidatePath("/plan");
  revalidatePath("/hoy");
  revalidatePath("/progreso");
  return { ok: true, score: data.score, level: wellnessLevel(data.score) };
}
