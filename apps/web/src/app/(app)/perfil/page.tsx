import { DISTANCE_LABELS, EXPERIENCE_LABELS, formatDate, GOAL_LABELS, LEVEL_LABELS, ROLE_LABELS, WEEKDAY_SHORT } from "@runner360/shared";
import type { Metadata } from "next";
import { Badge, ButtonLink, Card, CardTitle, DefinitionList, PageHeader } from "@/components/ui/primitives";
import { hasPremium, requireOnboardedSession } from "@/lib/auth";
import { loadTrainingProfile } from "@/lib/data/training";
import { DeleteAccountForm, IncidentForm, RevokeHealthButton } from "./account-forms";

export const metadata: Metadata = { title: "Perfil" };

const CONSENT_LABELS: Record<string, string> = {
  terms: "Términos y condiciones",
  privacy: "Política de privacidad",
  health_data: "Datos de salud",
  location: "Ubicación",
  marketing: "Comunicaciones",
};

export default async function ProfilePage() {
  const session = await requireOnboardedSession();
  const { supabase, user, profile } = session;
  const [tp, premium, { data: consents }] = await Promise.all([
    loadTrainingProfile(supabase, user.id, profile.birth_date),
    hasPremium(session),
    supabase.from("user_consents").select("consent_type, granted, document_version, created_at").order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, { granted: boolean; document_version: string; created_at: string }>();
  for (const c of (consents ?? []) as { consent_type: string; granted: boolean; document_version: string; created_at: string }[]) {
    if (!latest.has(c.consent_type)) latest.set(c.consent_type, c);
  }

  return (
    <>
      <PageHeader title="Perfil" actions={<ButtonLink href="/onboarding" variant="ghost">Editar perfil de corredor</ButtonLink>} />
      <div className="space-y-4">
        <Card>
          <CardTitle action={<Badge tone={premium ? "lime" : "neutral"}>{premium ? "Premium" : "Free"}</Badge>}>Cuenta</CardTitle>
          <DefinitionList
            items={[
              { term: "Nombre", value: profile.display_name ?? "—" },
              { term: "Correo", value: user.email ?? "—" },
              { term: "Fecha de nacimiento", value: profile.birth_date ? formatDate(profile.birth_date, "long") : "—" },
              { term: "Rol", value: ROLE_LABELS[profile.role] },
            ]}
          />
        </Card>
        {tp ? (
          <Card>
            <CardTitle>Perfil de corredor</CardTitle>
            <DefinitionList
              items={[
                { term: "Distancia objetivo", value: DISTANCE_LABELS[tp.profile.targetDistance] },
                { term: "Nivel", value: LEVEL_LABELS[tp.profile.level] },
                { term: "Experiencia", value: EXPERIENCE_LABELS[tp.profile.experience] },
                { term: "Km semanales", value: `${String(tp.profile.weeklyKm).replace(".", ",")} km` },
                { term: "Días disponibles", value: tp.profile.availableWeekdays.slice().sort().map((d) => WEEKDAY_SHORT[d - 1]).join(" · ") },
                { term: "Objetivo", value: GOAL_LABELS[tp.profile.goal] },
                { term: "Competencia", value: tp.profile.raceDate ? formatDate(tp.profile.raceDate, "long") : "Sin fecha" },
              ]}
            />
          </Card>
        ) : null}
        <Card>
          <CardTitle>Privacidad y datos</CardTitle>
          <ul className="mb-4 divide-y divide-line text-sm">
            {[...latest.entries()].map(([type, c]) => (
              <li key={type} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{CONSENT_LABELS[type] ?? type} <span className="text-xs text-muted">(v. {c.document_version}, {formatDate(c.created_at.slice(0, 10))})</span></span>
                <span className="flex items-center gap-2">
                  <Badge tone={c.granted ? "success" : "neutral"}>{c.granted ? "Otorgado" : "Revocado"}</Badge>
                  {type === "health_data" && c.granted ? <RevokeHealthButton /> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">No recopilamos tu ubicación. Podés descargar una copia de todos tus datos en formato JSON.</p>
          <div className="mt-3"><a href="/api/account/export" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold hover:bg-navy-100">Descargar mis datos</a></div>
        </Card>
        <Card>
          <CardTitle>Reportar un problema</CardTitle>
          <IncidentForm />
        </Card>
        <Card className="border-danger/30">
          <CardTitle>Eliminar cuenta</CardTitle>
          <p className="mb-3 text-sm text-muted">Se eliminan tu cuenta y todos tus datos personales y deportivos. Esta acción no se puede deshacer.</p>
          <DeleteAccountForm />
        </Card>
      </div>
    </>
  );
}
