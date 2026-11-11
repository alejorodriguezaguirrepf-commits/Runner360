import { todayIn } from "@runner360/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, cx, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { findPlan, getLibrary } from "@/lib/data/library";
import { acuteChronic, addDaysIso, LOAD_STATUS_LABEL, loadStatus, type LoadSession } from "@/lib/monitoring";
import { averageScore, WELLNESS_ITEMS, WELLNESS_LEVEL_LABEL, wellnessFlags, wellnessLevel, type WellnessRow } from "@/lib/wellness";

export const metadata: Metadata = { title: "Deportistas", robots: { index: false, follow: false } };

type W = WellnessRow & { user_id: string };
type L = LoadSession & { user_id: string; distance_m: number | null };
const LEVEL_TONE = { great: "text-success", good: "text-success", fair: "text-warning", low: "text-danger" } as const;
const shortDay = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

/**
 * Panel del entrenador: cada deportista con plan en curso o con datos de los últimos 28 días, su
 * wellness, su última sesión y su carga. Primero los que necesitan atención.
 */
export default async function AthletesPage() {
  const { supabase, profile } = await requireAdmin();
  const today = todayIn(profile.timezone);
  const from = addDaysIso(today, -27);
  const [{ data: wRows }, { data: lRows }, { data: eRows }, { data: users }, library] = await Promise.all([
    supabase.from("wellness_checkins").select("user_id, check_date, sleep, energy, soreness, stress, mood, score, note").gte("check_date", from).order("check_date"),
    supabase.from("workout_logs").select("user_id, workout_date, rpe, duration_s, distance_m").gte("workout_date", from).neq("status", "skipped").order("workout_date"),
    supabase.from("plan_enrollments").select("user_id, plan_id, status").in("status", ["active", "paused"]),
    supabase.rpc("admin_users", { p_query: "", p_limit: 2000, p_offset: 0 }),
    getLibrary(),
  ]);
  const wellness = (wRows ?? []) as W[];
  const logs = (lRows ?? []) as L[];
  const enrollments = (eRows ?? []) as { user_id: string; plan_id: string; status: string }[];
  const people = new Map(((users ?? []) as { id: string; email: string; display_name: string | null }[]).map((u) => [u.id, u]));

  const ids = new Set([...enrollments.map((e) => e.user_id), ...wellness.map((w) => w.user_id), ...logs.map((l) => l.user_id)]);
  const rows = [...ids].map((id) => {
    const w = wellness.filter((x) => x.user_id === id);
    const l = logs.filter((x) => x.user_id === id);
    const latest = w.at(-1) ?? null;
    const todayW = latest?.check_date === today ? latest : null;
    const ac = acuteChronic(l, today);
    const status = loadStatus(ac.ratio);
    const last = l.at(-1) ?? null;
    const enr = enrollments.find((e) => e.user_id === id);
    const flags = latest ? wellnessFlags(latest) : [];
    const alerts: string[] = [];
    if (latest && latest.check_date >= addDaysIso(today, -1) && wellnessLevel(latest.score) === "low") alerts.push("Wellness bajo");
    if (flags.length && latest && latest.check_date >= addDaysIso(today, -1)) alerts.push(flags.map((k) => WELLNESS_ITEMS[k].short).join(", ") + " en 1–2");
    if (status === "spike") alerts.push("Salto de carga");
    if (enr?.status === "paused") alerts.push("Plan en pausa");
    const person = people.get(id);
    return {
      id,
      name: person?.display_name || person?.email || "Deportista",
      email: person?.email ?? "",
      plan: enr ? (library ? findPlan(library, enr.plan_id)?.title : null) ?? "Plan en curso" : "Sin plan en curso",
      todayW,
      avg7: averageScore(w.filter((x) => x.check_date > addDaysIso(today, -7))),
      last,
      ac,
      status,
      alerts,
    };
  });
  rows.sort((a, b) => b.alerts.length - a.alerts.length || a.name.localeCompare(b.name, "es"));
  const answeredToday = rows.filter((r) => r.todayW).length;

  return (
    <>
      <PageHeader title="Deportistas" subtitle={`Wellness, sesiones y carga · ${answeredToday} de ${rows.length} respondieron el wellness hoy.`} />
      {rows.length === 0 ? (
        <Alert tone="info">Todavía no hay deportistas con plan en curso ni datos de los últimos 28 días.</Alert>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/deportistas/${r.id}`} className="block rounded-[var(--radius-card)] focus-visible:outline-3">
                <Card className={cx("transition hover:border-primary", r.alerts.length ? "border-danger/50" : undefined)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.name}</p>
                      <p className="truncate text-sm text-muted">{r.plan}{r.email && r.email !== r.name ? ` · ${r.email}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.alerts.map((a) => <Badge key={a} tone="danger">{a}</Badge>)}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-muted">Wellness hoy</dt>
                      <dd className="tabular font-bold">
                        {r.todayW ? <span className={LEVEL_TONE[wellnessLevel(r.todayW.score)]}>{r.todayW.score}/25 · {WELLNESS_LEVEL_LABEL[wellnessLevel(r.todayW.score)]}</span> : <span className="text-muted">Sin responder</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Promedio 7 días</dt>
                      <dd className="tabular font-bold">{r.avg7?.toLocaleString("es-AR") ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Última sesión</dt>
                      <dd className="tabular font-bold">
                        {r.last ? `${shortDay(r.last.workout_date)} · ${r.last.distance_m ? `${(r.last.distance_m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km · ` : ""}RPE ${r.last.rpe ?? "—"}` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Carga 7 días</dt>
                      <dd className="tabular font-bold">
                        {r.ac.acute || "—"}
                        {r.status ? <span className={cx("ml-1 text-xs font-semibold", r.status === "spike" ? "text-danger" : r.status === "high" ? "text-warning" : "text-muted")}>{LOAD_STATUS_LABEL[r.status]}</span> : null}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
