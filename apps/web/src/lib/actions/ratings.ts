"use server";

import { planDayAt } from "@runner360/plan-library";
import { formDataToObject, todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { getWeekDays } from "@/lib/data/library";
import { logError } from "@/lib/log";

const R = t.library.rating;

const ratingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.coerce.number().int().min(1).max(5),
  note: z.preprocess((x) => (typeof x === "string" ? x.trim() || null : null), z.string().max(500).nullable()),
});

/**
 * "¿Cómo te fue?": valoración 1–5 (y nota opcional) de un entrenamiento del plan en curso.
 * Solo días de entrenamiento ya ocurridos (hasta hoy). Se puede cambiar: una por día.
 */
export async function rateSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = ratingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, message: R.errors.pick };
  const { date, rating, note } = parsed.data;
  if (date > todayIn(profile.timezone)) return { ok: false, message: R.errors.future };

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: R.errors.generic };
  const slot = planDayAt(open.enrollment, open.segments, open.plan.duration_weeks, date);
  if (!slot) return { ok: false, message: R.errors.generic };
  const days = await getWeekDays(supabase, open.enrollment.content_version, open.plan.id, slot.planWeek);
  const day = days.find((d) => d.day_index === slot.dayIndex);
  if (!day || day.is_rest) return { ok: false, message: R.errors.generic };

  const { error } = await supabase.from("session_ratings").upsert(
    {
      user_id: user.id,
      enrollment_id: open.enrollment.id,
      workout_date: date,
      plan_week: slot.planWeek,
      plan_day_index: slot.dayIndex,
      rating,
      note,
    },
    { onConflict: "enrollment_id,workout_date" },
  );
  if (error) {
    logError("rating:save", error);
    return { ok: false, message: R.errors.generic };
  }
  revalidatePath("/plan");
  revalidatePath("/hoy");
  return { ok: true, message: R.saved };
}
