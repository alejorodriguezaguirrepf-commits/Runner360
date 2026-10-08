"use server";

import { assessReadiness } from "@runner360/training-engine";
import { fieldErrors, formDataToObject, onboardingSchema, todayIn } from "@runner360/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireSession } from "@/lib/auth";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";

export async function saveOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, profile } = await requireSession();
  const parsed = onboardingSchema.safeParse(formDataToObject(formData, ["availableWeekdays", "healthFlags"]));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Revisá los campos marcados." };
  const v = parsed.data;
  const today = todayIn(profile.timezone);

  if (v.birthDate >= today) return { ok: false, errors: { birthDate: "Fecha de nacimiento inválida" } };
  if (v.raceDate && v.raceDate < today) return { ok: false, errors: { raceDate: "La fecha de la competencia ya pasó" } };

  const readiness = assessReadiness(
    {
      birthDate: v.birthDate,
      targetDistance: v.targetDistance,
      level: v.level,
      experience: v.experience,
      weeklyKm: v.weeklyKm,
      availableWeekdays: v.availableWeekdays,
      recentMark: null,
      goal: v.goal,
      raceDate: v.raceDate,
      healthFlags: v.healthDataConsent ? v.healthFlags : [],
    },
    today,
  );

  const fail = (context: string, error: unknown): ActionState => {
    logError(`onboarding:${context}`, error);
    return { ok: false, message: "No pudimos guardar tu perfil. Probá nuevamente." };
  };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ display_name: v.displayName, birth_date: v.birthDate })
    .eq("id", user.id);
  if (pErr) return fail("profile", pErr);

  const { error: tErr } = await supabase.from("training_profiles").upsert({
    user_id: user.id,
    target_distance: v.targetDistance,
    level: v.level,
    experience: v.experience,
    weekly_km: v.weeklyKm,
    available_weekdays: v.availableWeekdays,
    recent_mark_distance_m: v.recentMarkDistanceKm,
    recent_mark_time_s: v.recentMarkTime,
    recent_mark_date: null,
    goal: v.goal,
    race_date: v.raceDate,
    preferences: { surface: v.preferredSurface, timeOfDay: v.preferredTime },
    readiness: readiness.status,
    readiness_reasons: readiness.reasons,
  });
  if (tErr) return fail("training_profile", tErr);

  // Consentimientos: términos y privacidad aceptados al registrarse se registran al completar el perfil.
  const { data: consents } = await supabase
    .from("user_consents")
    .select("consent_type, granted, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const latest = new Map<string, boolean>();
  for (const c of (consents ?? []) as { consent_type: string; granted: boolean }[]) {
    if (!latest.has(c.consent_type)) latest.set(c.consent_type, c.granted);
  }
  const newConsents: { user_id: string; consent_type: string; document_version: string; granted: boolean }[] = [];
  if (!latest.get("terms")) newConsents.push({ user_id: user.id, consent_type: "terms", document_version: LEGAL_VERSIONS.terms, granted: true });
  if (!latest.get("privacy")) newConsents.push({ user_id: user.id, consent_type: "privacy", document_version: LEGAL_VERSIONS.privacy, granted: true });
  const hadHealthConsent = latest.get("health_data") === true;
  if (v.healthDataConsent !== hadHealthConsent) {
    newConsents.push({ user_id: user.id, consent_type: "health_data", document_version: LEGAL_VERSIONS.health_data, granted: v.healthDataConsent });
  }
  if (newConsents.length) {
    const { error } = await supabase.from("user_consents").insert(newConsents);
    if (error) return fail("consents", error);
  }

  if (v.healthDataConsent) {
    const { error } = await supabase.from("health_screenings").upsert({ user_id: user.id, flags: v.healthFlags });
    if (error) return fail("health", error);
  } else {
    // Sin consentimiento no se conserva ningún antecedente de salud.
    await supabase.from("health_screenings").delete().eq("user_id", user.id);
  }

  if (!profile.onboarding_completed_at) {
    const { error } = await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
    if (error) return fail("complete", error);
  }

  revalidatePath("/", "layout");
  redirect("/plan");
}
