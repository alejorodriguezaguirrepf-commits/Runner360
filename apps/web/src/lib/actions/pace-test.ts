"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { logError } from "@/lib/log";

const schema = z
  .object({ distanceM: z.number().int().min(100).max(100_000), timeS: z.number().int().min(10).max(86_400) })
  .refine((v) => (v.timeS * 1000) / v.distanceM >= 90 && (v.timeS * 1000) / v.distanceM <= 1800, "Ritmo fuera de rango");

/** Guarda el último test de la calculadora (uno por persona). */
export async function savePaceTestAction(distanceM: number, timeS: number): Promise<ActionState> {
  const { supabase, user } = await requireOnboardedSession();
  const parsed = schema.safeParse({ distanceM: Math.round(distanceM), timeS: Math.round(timeS) });
  if (!parsed.success) return { ok: false, message: "Revisá los km y el tiempo del test." };
  const { error } = await supabase
    .from("user_pace_tests")
    .upsert({ user_id: user.id, distance_m: parsed.data.distanceM, time_s: parsed.data.timeS }, { onConflict: "user_id" });
  if (error) {
    logError("savePaceTest", error);
    return { ok: false, message: "No pudimos guardar tu test. Probá de nuevo." };
  }
  // Los planes usan el test como ritmo de referencia para mostrar los km.
  revalidatePath("/plan");
  revalidatePath("/hoy");
  return { ok: true, message: "Test guardado." };
}
