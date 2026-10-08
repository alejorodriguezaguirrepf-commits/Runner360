import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { requireSession } from "@/lib/auth";
import { loadTrainingProfile } from "@/lib/data/training";
import { OnboardingForm, type OnboardingDefaults } from "./onboarding-form";

export const metadata: Metadata = { title: "Tu perfil de corredor" };

export default async function OnboardingPage() {
  const { supabase, user, profile } = await requireSession("/onboarding");
  const existing = await loadTrainingProfile(supabase, user.id, profile.birth_date);
  const prefs = (existing?.row.preferences ?? {}) as { surface?: string | null; timeOfDay?: string | null };
  const defaults: OnboardingDefaults = {
    displayName: profile.display_name ?? "",
    birthDate: profile.birth_date ?? "",
    targetDistance: existing?.row.target_distance ?? "",
    level: existing?.row.level ?? "",
    experience: existing?.row.experience ?? "",
    weeklyKm: existing ? String(existing.row.weekly_km).replace(".", ",") : "",
    availableWeekdays: (existing?.row.available_weekdays ?? []).map(String),
    goal: existing?.row.goal ?? "",
    raceDate: existing?.row.race_date ?? "",
    recentMarkDistanceKm: existing?.row.recent_mark_distance_m ? String(existing.row.recent_mark_distance_m / 1000).replace(".", ",") : "",
    recentMarkTime: existing?.row.recent_mark_time_s ? secondsToClock(existing.row.recent_mark_time_s) : "",
    preferredSurface: prefs.surface ?? "",
    preferredTime: prefs.timeOfDay ?? "",
    healthFlags: existing?.profile.healthFlags ?? [],
  };
  const editing = Boolean(profile.onboarding_completed_at);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          {editing ? <Link href="/perfil" className="text-sm font-semibold text-navy-700 hover:underline">Volver al perfil</Link> : null}
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{editing ? "Editá tu perfil de corredor" : "Contanos sobre vos"}</h1>
        <p className="mt-1 text-sm text-muted">
          Pedimos solo lo necesario para proponerte un plan seguro. Podés cambiar estas respuestas cuando quieras.
        </p>
        <OnboardingForm defaults={defaults} />
      </main>
    </div>
  );
}

function secondsToClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
