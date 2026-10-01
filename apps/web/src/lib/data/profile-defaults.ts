import { formatDuration } from "@runner360/shared";
import type { ProfileDefaults } from "@/components/onboarding/training-profile-form";
import type { loadRunnerProfile } from "./training";

const kmString = (m: number | null | undefined) => (m == null ? "" : String(m / 1000).replace(".", ","));

export function profileDefaults(
  profile: { display_name: string | null; birth_date: string | null } | null,
  existing: Awaited<ReturnType<typeof loadRunnerProfile>>,
): ProfileDefaults {
  const r = existing?.row;
  return {
    displayName: profile?.display_name ?? "",
    birthDate: profile?.birth_date ?? "",
    targetDistance: r?.target_distance ?? "5k",
    level: r?.level ?? "beginner",
    experienceMonths: r ? String(r.experience_months) : "",
    weeklyKm: r ? kmString(r.weekly_distance_m) : "",
    availableDays: r?.available_days ?? [],
    recentRaceKm: kmString(r?.recent_race_distance_m),
    recentRaceTime: r?.recent_race_time_s ? formatDuration(r.recent_race_time_s) : "",
    goal: r?.goal ?? "complete",
    raceDate: r?.race_date ?? "",
    preferences: r?.preferences ?? "",
    hasRecentInjury: Boolean(existing?.health?.has_recent_injury),
    hasMedicalCondition: Boolean(existing?.health?.has_medical_condition),
    healthNotes: existing?.health?.notes ?? "",
  };
}
