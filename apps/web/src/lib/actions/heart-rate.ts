"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedSession } from "@/lib/auth";
import { MIN_CONFIDENCE } from "@/lib/heart-rate/measurementSession";
import { logError } from "@/lib/log";

const schema = z.object({
  beats: z.number().int().min(4).max(21),
  confidence: z.number().min(MIN_CONFIDENCE).max(1),
  context: z.enum(["reposo", "post_carrera", "otro"]),
  runId: z.uuid().optional(),
  measuredAt: z.iso.datetime(),
});
export type HeartRateInput = z.input<typeof schema>;

/**
 * Guardado automático de una medición válida (lo llama la pantalla al terminar el conteo). La base
 * calcula bpm = beats × 10 y vuelve a controlar calidad, rango y que la carrera sea propia.
 */
export async function saveHeartRateAction(input: HeartRateInput): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { supabase } = await requireOnboardedSession();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "La medición no es válida." };
  const v = parsed.data;
  // Hora del dispositivo: si viene corrida, se usa la del servidor.
  const at = new Date(v.measuredAt);
  const now = Date.now();
  const measuredAt = Math.abs(now - at.getTime()) < 60 * 60 * 1000 ? at.toISOString() : new Date(now).toISOString();
  const { data, error } = await supabase
    .from("heart_rate_measurements")
    .insert({ beats: v.beats, confidence: Math.round(v.confidence * 1000) / 1000, context: v.context, run_id: v.runId ?? null, measured_at: measuredAt })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    logError("heart-rate:save", { code: error?.code });
    return { ok: false, message: "No se pudo guardar." };
  }
  revalidatePath("/pulsaciones");
  return { ok: true, id: data.id };
}
