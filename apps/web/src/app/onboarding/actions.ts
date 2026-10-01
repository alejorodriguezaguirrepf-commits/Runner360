"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LEGAL_VERSIONS, trainingProfileSchema } from "@runner360/shared";
import { bool, dbErrorState, intList, intOrNull, str, strOrNull, withValues, zodToState, type ActionState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";
import { parseDuration, parseKmToMeters } from "@runner360/shared";

/** Guarda el perfil deportivo. La validación se repite aquí (servidor) aunque el cliente valide. */
export async function saveTrainingProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return withValues(await save(fd), fd);
}

async function save(fd: FormData): Promise<ActionState> {
  // No se usa getViewer() (cacheado por request): tras el redirect se renderiza /app/plan en el mismo
  // request y necesita ver el onboarding ya completado.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "Tu sesión expiró. Volvé a ingresar." };
  const { data: current } = await supabase.from("profiles").select("onboarding_completed_at").eq("id", auth.user.id).maybeSingle();
  const viewer = { id: auth.user.id, onboardingCompleted: Boolean(current?.onboarding_completed_at) };

  const weeklyKm = str(fd, "weeklyKm");
  const recentKm = str(fd, "recentRaceKm");
  const recentTime = str(fd, "recentRaceTime");
  const input = {
    displayName: str(fd, "displayName"),
    birthDate: str(fd, "birthDate"),
    targetDistance: str(fd, "targetDistance"),
    level: str(fd, "level"),
    experienceMonths: intOrNull(fd, "experienceMonths") ?? Number.NaN,
    weeklyDistanceM: weeklyKm === "" ? 0 : (parseKmToMeters(weeklyKm) ?? Number.NaN),
    availableDays: intList(fd, "availableDays"),
    recentRaceDistanceM: recentKm === "" ? null : (parseKmToMeters(recentKm) ?? Number.NaN),
    recentRaceTimeS: recentTime === "" ? null : (parseDuration(recentTime) ?? Number.NaN),
    goal: str(fd, "goal"),
    raceDate: strOrNull(fd, "raceDate"),
    preferences: strOrNull(fd, "preferences"),
    hasRecentInjury: bool(fd, "hasRecentInjury"),
    hasMedicalCondition: bool(fd, "hasMedicalCondition"),
    healthNotes: strOrNull(fd, "healthNotes"),
    healthDataConsent: bool(fd, "healthDataConsent"),
  };
  const parsed = trainingProfileSchema.safeParse(input);
  if (!parsed.success) return zodToState(parsed.error);
  const v = parsed.data;

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ display_name: v.displayName, birth_date: v.birthDate })
    .eq("id", viewer.id);
  if (pErr) return dbErrorState("onboarding.profile", pErr);

  const { error: tErr } = await supabase.from("training_profiles").upsert({
    user_id: viewer.id,
    target_distance: v.targetDistance,
    level: v.level,
    experience_months: v.experienceMonths,
    weekly_distance_m: v.weeklyDistanceM,
    available_days: [...v.availableDays].sort((a, b) => a - b),
    recent_race_distance_m: v.recentRaceDistanceM,
    recent_race_time_s: v.recentRaceTimeS,
    goal: v.goal,
    race_date: v.raceDate,
    preferences: v.preferences,
  });
  if (tErr) return dbErrorState("onboarding.training_profile", tErr);

  // Datos de salud: solo con consentimiento expreso (la RLS también lo exige).
  const providesHealth = v.hasRecentInjury || v.hasMedicalCondition || !!v.healthNotes;
  if (providesHealth) {
    const { error: cErr } = await supabase.from("user_consents").insert({
      user_id: viewer.id,
      consent_type: "health_data",
      document_version: LEGAL_VERSIONS.health_data,
      granted: true,
    });
    if (cErr) return dbErrorState("onboarding.consent", cErr);
    const { error: hErr } = await supabase.from("training_health_info").upsert({
      user_id: viewer.id,
      has_recent_injury: v.hasRecentInjury,
      has_medical_condition: v.hasMedicalCondition,
      notes: v.healthNotes,
    });
    if (hErr) return dbErrorState("onboarding.health", hErr);
  } else {
    // Minimización: si ya no hay antecedentes declarados, se elimina el registro previo.
    await supabase.from("training_health_info").delete().eq("user_id", viewer.id);
  }

  if (!viewer.onboardingCompleted) {
    await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", viewer.id);
  }
  // Invalida la caché del router: rutas privadas prefetcheadas antes del onboarding redirigían aquí.
  revalidatePath("/", "layout");
  redirect("/app/plan?desde=perfil");
}
