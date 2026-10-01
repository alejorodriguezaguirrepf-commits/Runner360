import type { Metadata } from "next";
import { Download, LogOut } from "lucide-react";
import { formatDate, RACE_DISTANCE_LABELS, RUNNER_LEVEL_LABELS, TRAINING_GOAL_LABELS, WEEKDAY_SHORT, type Weekday } from "@runner360/shared";
import { signOutAction } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/app/page-header";
import { DeleteAccountForm, IncidentForm } from "@/components/app/profile-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedViewer } from "@/lib/auth";
import { loadRunnerProfile } from "@/lib/data/training";
import { createClient } from "@/lib/supabase/server";
import { revokeHealthConsentAction } from "./actions";

export const metadata: Metadata = { title: "Perfil" };

const CONSENT_LABELS: Record<string, string> = {
  terms: "Términos y condiciones",
  privacy: "Política de privacidad",
  health_data: "Datos de salud",
  location: "Ubicación",
  marketing: "Comunicaciones comerciales",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer("/app/perfil");
  const supabase = await createClient();
  const [profile, { data: consents }] = await Promise.all([
    loadRunnerProfile(supabase, viewer.id),
    supabase.from("user_consents").select("consent_type, document_version, granted, created_at").order("created_at", { ascending: false }),
  ]);
  const latest = new Map<string, { granted: boolean; document_version: string; created_at: string }>();
  for (const c of (consents ?? []) as { consent_type: string; granted: boolean; document_version: string; created_at: string }[]) {
    if (!latest.has(c.consent_type)) latest.set(c.consent_type, c);
  }
  const r = profile?.row;

  return (
    <>
      <PageHeader title="Perfil" description={viewer.email} />
      {sp.salud === "revocado" ? <Alert tone="success" className="mb-4">Eliminamos tus datos de salud y registramos la revocación.</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Perfil de corredor" action={<ButtonLink href="/onboarding" variant="secondary" size="sm">Editar</ButtonLink>} />
          {r ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">Distancia objetivo</dt><dd className="font-semibold">{RACE_DISTANCE_LABELS[r.target_distance]}</dd></div>
              <div><dt className="text-muted">Nivel</dt><dd className="font-semibold">{RUNNER_LEVEL_LABELS[r.level]}</dd></div>
              <div><dt className="text-muted">Objetivo</dt><dd className="font-semibold">{TRAINING_GOAL_LABELS[r.goal]}</dd></div>
              <div><dt className="text-muted">Competencia</dt><dd className="font-semibold">{r.race_date ? formatDate(r.race_date) : "—"}</dd></div>
              <div className="col-span-2"><dt className="text-muted">Días disponibles</dt><dd className="font-semibold">{r.available_days.map((d) => WEEKDAY_SHORT[d as Weekday]).join(" · ")}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Sin datos.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {viewer.roles.map((role) => <Badge key={role} tone={role === "admin" ? "navy" : "neutral"}>{role === "admin" ? "Administrador" : role === "coach" ? "Entrenador" : "Usuario"}</Badge>)}
          </div>
        </Card>

        <Card>
          <CardHeader title="Privacidad y consentimientos" />
          <ul className="divide-y divide-line text-sm">
            {[...latest.entries()].map(([type, c]) => (
              <li key={type} className="flex items-center justify-between gap-3 py-2">
                <span>{CONSENT_LABELS[type] ?? type}<span className="block text-xs text-muted">v. {c.document_version} · {formatDate(c.created_at)}</span></span>
                <Badge tone={c.granted ? "success" : "neutral"}>{c.granted ? "Otorgado" : "Revocado"}</Badge>
              </li>
            ))}
            {latest.size === 0 ? <li className="py-2 text-muted">Sin registros.</li> : null}
          </ul>
          {latest.get("health_data")?.granted ? (
            <form action={revokeHealthConsentAction} className="mt-4">
              <SubmitButton variant="secondary" size="sm" pendingText="Procesando…">Revocar consentimiento de salud y borrar esos datos</SubmitButton>
            </form>
          ) : null}
          <p className="mt-4 text-xs text-muted">No recopilamos tu ubicación.</p>
          <a href="/api/me/export" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-navy-600 underline">
            <Download className="size-4" aria-hidden /> Descargar mis datos (JSON)
          </a>
        </Card>

        <Card>
          <CardHeader title="Reportar un problema" description="Lo revisa el equipo de RUNNER 360." />
          <IncidentForm />
        </Card>

        <Card>
          <CardHeader title="Sesión" />
          <form action={signOutAction}>
            <Button type="submit" variant="secondary"><LogOut className="size-4" aria-hidden /> Cerrar sesión</Button>
          </form>
          <details className="mt-6 rounded-xl border border-danger/30 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-danger">Eliminar cuenta</summary>
            <p className="my-3 text-sm text-muted">Se eliminarán tu perfil, tus planes, registros, hidratación y competencias. Esta acción no se puede deshacer.</p>
            <DeleteAccountForm />
          </details>
        </Card>
      </div>
    </>
  );
}
