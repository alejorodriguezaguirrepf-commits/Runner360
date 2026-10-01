import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { TrainingProfileForm } from "@/components/onboarding/training-profile-form";
import { requireViewer } from "@/lib/auth";
import { profileDefaults } from "@/lib/data/profile-defaults";
import { loadRunnerProfile } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tu perfil de corredor" };

export default async function OnboardingPage() {
  const viewer = await requireViewer("/onboarding");
  const supabase = await createClient();
  const [existing, { data: profile }] = await Promise.all([
    loadRunnerProfile(supabase, viewer.id),
    supabase.from("profiles").select("display_name, birth_date").eq("id", viewer.id).maybeSingle(),
  ]);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Logo href="/app" />
        </div>
      </header>
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-navy">Contanos sobre tu entrenamiento</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Usamos estas respuestas para sugerirte un plan compatible. Solo pedimos lo necesario.
        </p>
        <TrainingProfileForm
          submitLabel={viewer.onboardingCompleted ? "Guardar cambios" : "Ver mi plan sugerido"}
          defaults={profileDefaults(profile as { display_name: string | null; birth_date: string | null } | null, existing)}
        />
      </main>
    </div>
  );
}
