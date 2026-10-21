"use server";

import { isPermutation, raceDateFromStart, type DayMapViolation } from "@runner360/plan-library";
import { formatDate, formDataToObject, todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fmt, t } from "@/i18n";
import type { ActionState } from "@/lib/action-state";
import { requireOnboardedSession } from "@/lib/auth";
import { enrollmentOver, getOpenEnrollment } from "@/lib/data/enrollment";
import { findPlan, getLibrary } from "@/lib/data/library";
import { startMondays } from "@/lib/library/start";
import { logError } from "@/lib/log";

const e = t.library.enroll.errors;

const enrollSchema = z.object({
  plan: z.string().regex(/^plan-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  safety: z.literal("on", { error: () => ({ message: e.safety }) }),
});

/**
 * Inscripción directa a un plan (sin evaluación previa). Cualquiera puede empezar: sin suscripción
 * se ve la muestra gratuita; con la suscripción, cada débito mensual libera el mes siguiente.
 */
export async function enrollLibraryPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = enrollSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const safety = parsed.error.issues.some((i) => i.path[0] === "safety");
    return safety ? { ok: false, errors: { safety: e.safety }, message: e.safety } : { ok: false, message: e.generic };
  }

  const library = await getLibrary();
  const plan = library ? findPlan(library, parsed.data.plan) : null;
  if (!library || !plan) return { ok: false, message: e.generic };

  const today = todayIn(profile.timezone);
  const startDate = parsed.data.startDate;
  const mondays = startMondays(today);
  if (!mondays.includes(startDate)) {
    const msg = fmt(e.startRange, { date: formatDate(mondays[0]!, "long") });
    return { ok: false, errors: { startDate: msg }, message: msg };
  }
  const raceDate = raceDateFromStart(startDate, plan.race_week);

  const open = await getOpenEnrollment(supabase, user.id);
  if (open) {
    // Un plan ya terminado se cierra solo al elegir otro.
    if (!enrollmentOver(open, today)) return { ok: false, message: e.alreadyEnrolled };
    await supabase.from("plan_enrollments").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", open.enrollment.id);
  }

  const { error } = await supabase.from("plan_enrollments").insert({
    user_id: user.id,
    content_version: plan.content_version,
    plan_id: plan.id,
    start_date: startDate,
    race_date: raceDate,
  });
  if (error) {
    logError("enrollment:insert", error);
    return { ok: false, message: error.code === "23505" ? e.alreadyEnrolled : e.generic };
  }
  // Un plan DEMO activo (sistema anterior) se cierra: no puede haber dos planes en curso.
  await supabase.from("user_training_plans").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "active");

  revalidatePath("/", "layout");
  redirect("/plan?inscripto=1");
}

const renewSchema = z.object({
  enrollment: z.uuid(),
  safety: z.literal("on", { error: () => ({ message: e.safety }) }),
});

/**
 * Renovar un plan terminado: el mismo plan, en la versión vigente de la biblioteca, desde el próximo
 * lunes. Con el plan anual vigente queda completo sin pagar (lo decide la base, enrollment_open_weeks).
 */
export async function renewEnrollmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireOnboardedSession();
  const parsed = renewSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const safety = parsed.error.issues.some((i) => i.path[0] === "safety");
    return safety ? { ok: false, errors: { safety: e.safety }, message: e.safety } : { ok: false, message: e.generic };
  }
  const today = todayIn(profile.timezone);
  const { data: row } = await supabase
    .from("plan_enrollments")
    .select("id, plan_id, status")
    .eq("id", parsed.data.enrollment)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; plan_id: string; status: string }>();
  if (!row) return { ok: false, message: e.generic };
  const open = await getOpenEnrollment(supabase, user.id);
  if (open) {
    if (open.enrollment.id !== row.id || !enrollmentOver(open, today)) return { ok: false, message: e.alreadyEnrolled };
    await supabase.from("plan_enrollments").update({ status: "completed", ended_at: new Date().toISOString() }).eq("id", row.id);
  } else if (row.status !== "completed") {
    return { ok: false, message: e.generic };
  }

  const library = await getLibrary();
  const plan = library ? findPlan(library, row.plan_id) : null;
  if (!plan) return { ok: false, message: e.generic };
  const startDate = startMondays(today)[0]!;
  const { error } = await supabase.from("plan_enrollments").insert({
    user_id: user.id,
    content_version: plan.content_version,
    plan_id: plan.id,
    start_date: startDate,
    race_date: raceDateFromStart(startDate, plan.race_week),
  });
  if (error) {
    logError("enrollment:renew", error);
    return { ok: false, message: error.code === "23505" ? e.alreadyEnrolled : e.generic };
  }
  revalidatePath("/", "layout");
  redirect("/plan?inscripto=1");
}

const dayMapSchema = z.object(Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`d${i}`, z.coerce.number().int().min(0).max(6)])));

export interface MoveDaysState extends ActionState {
  violations?: DayMapViolation[];
}

/** Mover días: se valida en el servidor (y otra vez en la base) la regla de días exigentes. */
export async function moveDaysAction(_prev: MoveDaysState, formData: FormData): Promise<MoveDaysState> {
  const { supabase, user } = await requireOnboardedSession();
  const parsed = dayMapSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, violations: ["not_permutation"] };
  const map = Array.from({ length: 7 }, (_, i) => parsed.data[`d${i}`] as number);
  if (!isPermutation(map)) return { ok: false, violations: ["not_permutation"] };

  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return { ok: false, message: e.generic };
  // Todas las semanas del plan (aunque la persona no tenga acceso al detalle de todas).
  const { data: violations, error: rpcError } = await supabase.rpc("library_day_map_violations", {
    p_version: open.enrollment.content_version,
    p_plan: open.enrollment.plan_id,
    p_map: map,
  });
  if (rpcError) {
    logError("enrollment:violations", rpcError);
    return { ok: false, message: e.generic };
  }
  if (Array.isArray(violations) && violations.length > 0) return { ok: false, violations: violations as DayMapViolation[] };

  const { error } = await supabase.from("plan_enrollments").update({ day_map: map }).eq("id", open.enrollment.id);
  if (error) {
    logError("enrollment:move", error);
    return { ok: false, message: e.generic };
  }
  revalidatePath("/plan");
  return { ok: true, message: t.library.moveDays.saved };
}

export async function cancelEnrollmentAction(): Promise<void> {
  const { supabase, user } = await requireOnboardedSession();
  await supabase
    .from("plan_enrollments")
    .update({ status: "cancelled", ended_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("status", ["active", "paused"]);
  revalidatePath("/", "layout");
  redirect("/plan");
}
