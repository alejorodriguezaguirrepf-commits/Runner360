import { formatDate } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, type BarDatum } from "@/components/charts/bar-chart";
import { HeartRateTab, type HeartRateContext } from "@/components/heart-rate/heart-rate-tab";
import { Card, CardTitle, cx, PageHeader } from "@/components/ui/primitives";
import { saveHeartRateAction } from "@/lib/actions/heart-rate";
import { requireOnboardedSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/notifications/payment-texts";

export const metadata: Metadata = { title: "Pulsaciones" };

const CONTEXTS: { value: HeartRateContext; label: string }[] = [
  { value: "reposo", label: "En reposo" },
  { value: "post_carrera", label: "Después de correr" },
  { value: "otro", label: "Otro momento" },
];
const CONTEXT_LABEL: Record<HeartRateContext, string> = { reposo: "En reposo", post_carrera: "Post-carrera", otro: "Otro" };

type Row = { id: string; bpm: number; beats: number; context: HeartRateContext; measured_at: string; run_id: string | null };

/** Pulsaciones con la cámara (6" × 10), con el historial y la evolución en reposo debajo. */
export default async function HeartRatePage({ searchParams }: { searchParams: Promise<{ contexto?: string; entrenamiento?: string }> }) {
  const { supabase, user } = await requireOnboardedSession();
  const sp = await searchParams;
  const context: HeartRateContext = CONTEXTS.some((c) => c.value === sp.contexto) ? (sp.contexto as HeartRateContext) : "reposo";
  // La carrera tiene que ser de la persona (la base lo vuelve a controlar al guardar).
  const runParam = sp.entrenamiento && /^[0-9a-f-]{36}$/i.test(sp.entrenamiento) ? sp.entrenamiento : null;
  const [{ data: run }, { data: rows }] = await Promise.all([
    runParam
      ? supabase.from("workout_logs").select("id, workout_date").eq("id", runParam).eq("user_id", user.id).maybeSingle<{ id: string; workout_date: string }>()
      : Promise.resolve({ data: null }),
    supabase.from("heart_rate_measurements").select("id, bpm, beats, context, measured_at, run_id").order("measured_at", { ascending: false }).limit(60),
  ]);
  const runId = context === "post_carrera" && run ? run.id : undefined;
  const history = (rows ?? []) as Row[];
  const resting = history
    .filter((r) => r.context === "reposo")
    .slice(0, 14)
    .reverse()
    .map<BarDatum>((r) => ({ key: r.id, label: formatDate(r.measured_at.slice(0, 10)).replace(/^\w+,\s*/, ""), value: r.bpm, display: `${r.bpm} ppm` }));

  return (
    <>
      <PageHeader title="Pulsaciones" subtitle="Subí el brillo al máximo y apoyá el dedo sobre la cámara de adelante: la app cuenta tus latidos durante 6 segundos y los multiplica por 10." />

      <nav aria-label="Cuándo medís" className="mb-4 flex flex-wrap gap-2">
        {CONTEXTS.map((c) => {
          const current = c.value === context;
          const href = `/pulsaciones?contexto=${c.value}${c.value === "post_carrera" && run ? `&entrenamiento=${run.id}` : ""}`;
          return (
            <Link
              key={c.value}
              href={href}
              replace
              aria-current={current ? "page" : undefined}
              className={cx(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
                current ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink hover:border-primary",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>
      {runId && run ? <p className="mb-4 text-sm text-muted">Pulso post-carrera de tu entrenamiento del {formatDate(run.workout_date, "long")}.</p> : null}

      {/* key: al cambiar de contexto se reinicia la medición con la cámara ya prendida. */}
      <HeartRateTab key={`${context}-${runId ?? ""}`} context={context} runId={runId} onAutoSave={saveHeartRateAction} />

      <div className="mt-6 space-y-4">
        {resting.length >= 2 ? (
          <Card>
            <CardTitle>Evolución en reposo</CardTitle>
            <BarChart title="Pulsaciones en reposo, últimas mediciones" data={resting} unitLabel="pulsaciones por minuto" />
          </Card>
        ) : null}
        <Card>
          <CardTitle>Últimas mediciones</CardTitle>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Todavía no hay mediciones. Cuando midas, se guardan solas acá.</p>
          ) : (
            <ul className="divide-y divide-line">
              {history.slice(0, 10).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="block font-semibold text-ink">{formatDateTime(r.measured_at)}</span>
                    <span className="text-muted">
                      {CONTEXT_LABEL[r.context]} · {r.beats} latidos en 6&quot;
                    </span>
                  </span>
                  <span className="tabular text-xl font-extrabold text-ink">
                    {r.bpm} <span className="text-xs font-semibold text-muted">ppm</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
