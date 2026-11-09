import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import {
  debitStatus,
  intervalLabel,
  nextDate,
  ORIGIN_LABELS,
  providerLabel,
  subscriptionOrigin,
  subscriptionState,
  type Debit,
  type Origin,
  type Subscriber,
} from "@/lib/admin/subscriptions";
import { requireAdmin } from "@/lib/auth";
import { failureReason, formatAmount, formatDateTime } from "@/lib/notifications/payment-texts";

export const metadata: Metadata = { title: "Suscripciones", robots: { index: false, follow: false } };

type DebitRow = Pick<Debit, "payment_id" | "user_id" | "status" | "amount_minor" | "currency" | "paid_at" | "failure_code" | "provider_payment_id">;
type View = "todas" | "compraron" | "manuales" | "sin-pago" | "debitos";
const FILTERS: { view: View; label: string; origin?: Origin }[] = [
  { view: "todas", label: "Todas" },
  { view: "compraron", label: "Compraron", origin: "paid" },
  { view: "manuales", label: "Asignadas a mano", origin: "manual" },
  { view: "sin-pago", label: "Sin pago", origin: "unpaid" },
  { view: "debitos", label: "Todos los débitos" },
];
const DEBITS_PAGE = 50;

function DebitLine({ d }: { d: DebitRow }) {
  const s = debitStatus(d.status);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 first:border-t-0">
      <span className="text-sm">
        <span className="font-semibold text-ink">{formatDateTime(d.paid_at)}</span>
        <span className="text-muted"> · {formatAmount(d.amount_minor, d.currency)}</span>
        {d.status === "rejected" ? <span className="block text-xs text-muted">Motivo: {failureReason(d.failure_code)}</span> : null}
      </span>
      <Badge tone={s.tone}>{s.label}</Badge>
    </li>
  );
}

/** Quién compró una suscripción, quién la tiene asignada a mano y cuándo se le debitó a cada uno. */
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string; pagina?: string }> }) {
  const { supabase } = await requireAdmin();
  const { vista, q = "", pagina = "1" } = await searchParams;
  const view: View = FILTERS.some((f) => f.view === vista) ? (vista as View) : "todas";
  const query = q.trim().toLowerCase();
  const now = new Date();

  if (view === "debitos") {
    const page = Math.max(1, Number(pagina) || 1);
    const { data, error } = await supabase.rpc("admin_debits", { p_user_id: null, p_limit: DEBITS_PAGE, p_offset: (page - 1) * DEBITS_PAGE });
    const debits = (data ?? []) as Debit[];
    const total = debits[0]?.total_count ?? 0;
    return (
      <>
        <PageHeader title="Suscripciones" subtitle={`${total} débitos registrados, del más nuevo al más viejo.`} />
        <Filters view={view} q={q} />
        {error ? <Alert tone="danger">No se pudo cargar el listado de débitos.</Alert> : null}
        {!error && debits.length === 0 ? <EmptyState title="Todavía no hay débitos" /> : null}
        {debits.length > 0 ? (
          <Card>
            <ul>
              {debits.map((d) => (
                <li key={d.payment_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3 first:border-t-0">
                  <span className="min-w-0 text-sm">
                    <Link href={`/admin/suscripciones?q=${encodeURIComponent(d.email)}`} className="block truncate font-semibold text-primary-ink underline">
                      {d.display_name ? `${d.display_name} · ` : ""}{d.email}
                    </Link>
                    <span className="text-ink">{formatDateTime(d.paid_at)}</span>
                    <span className="text-muted"> · {formatAmount(d.amount_minor, d.currency)} · {providerLabel(d.provider)}</span>
                    {d.status === "rejected" ? <span className="block text-xs text-muted">Motivo: {failureReason(d.failure_code)}</span> : null}
                  </span>
                  <Badge tone={debitStatus(d.status).tone}>{debitStatus(d.status).label}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <div className="mt-4 flex gap-4 text-sm">
          {page > 1 ? <Link className="min-h-11 py-2 font-semibold text-primary-ink" href={`?vista=debitos&pagina=${page - 1}`}>← Más nuevos</Link> : null}
          {total > page * DEBITS_PAGE ? <Link className="min-h-11 py-2 font-semibold text-primary-ink" href={`?vista=debitos&pagina=${page + 1}`}>Más viejos →</Link> : null}
        </div>
      </>
    );
  }

  const { data, error } = await supabase.rpc("admin_subscribers");
  const all = (data ?? []) as Subscriber[];
  const counts = { paid: 0, manual: 0, unpaid: 0 } as Record<Origin, number>;
  for (const s of all) counts[subscriptionOrigin(s)] += 1;
  const origin = FILTERS.find((f) => f.view === view)?.origin;
  const rows = all.filter(
    (s) => (!origin || subscriptionOrigin(s) === origin) && (!query || s.email.toLowerCase().includes(query) || (s.display_name ?? "").toLowerCase().includes(query)),
  );
  // Historial de débitos de las personas listadas (los admins pueden leer la tabla de débitos).
  const ids = rows.map((r) => r.user_id);
  const { data: debitData } = ids.length
    ? await supabase
        .from("subscription_payments")
        .select("payment_id:id, user_id, status, amount_minor, currency, paid_at, failure_code, provider_payment_id")
        .in("user_id", ids)
        .order("paid_at", { ascending: false })
    : { data: [] };
  const byUser = new Map<string, DebitRow[]>();
  for (const d of (debitData ?? []) as DebitRow[]) byUser.set(d.user_id, [...(byUser.get(d.user_id) ?? []), d]);

  return (
    <>
      <PageHeader
        title="Suscripciones"
        subtitle={`${counts.paid} compraron · ${counts.manual} asignadas a mano · ${counts.unpaid} sin pago.`}
      />
      <Filters view={view} q={q} />
      <form className="mb-4 flex gap-2" role="search">
        {view !== "todas" ? <input type="hidden" name="vista" value={view} /> : null}
        <label className="sr-only" htmlFor="q">Buscar por correo o nombre</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por correo o nombre" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm" />
        <button className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Buscar</button>
      </form>
      {error ? <Alert tone="danger">No se pudo cargar el listado de suscripciones.</Alert> : null}
      {!error && rows.length === 0 ? <EmptyState title={query ? "No hay suscripciones que coincidan" : "No hay suscripciones en esta categoría"} /> : null}
      <ul className="space-y-3">
        {rows.map((s) => {
          const o = ORIGIN_LABELS[subscriptionOrigin(s)];
          const st = subscriptionState(s, now);
          const next = nextDate(s, now);
          const debits = byUser.get(s.user_id) ?? [];
          return (
            <li key={s.subscription_id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{s.email}</p>
                    <p className="text-sm text-muted">{s.display_name ?? "Sin nombre"} · {s.plan}{intervalLabel(s.billing_interval) ? ` (${intervalLabel(s.billing_interval)})` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={o.tone}>{o.label}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted">Medio</dt><dd>{providerLabel(s.provider)}</dd></div>
                  <div><dt className="text-xs text-muted">Desde</dt><dd>{formatDateTime(s.started_at ?? s.subscribed_at)}</dd></div>
                  <div>
                    <dt className="text-xs text-muted">Último débito</dt>
                    <dd>{s.last_paid_at ? <>{formatDateTime(s.last_paid_at)}<span className="block text-xs text-muted">{formatAmount(s.last_paid_minor, s.paid_currency)}</span></> : "—"}</dd>
                  </div>
                  <div><dt className="text-xs text-muted">{next?.label ?? "Próximo débito"}</dt><dd>{next ? formatDateTime(next.at) : "—"}</dd></div>
                  <div className="col-span-2 sm:col-span-4">
                    <dt className="text-xs text-muted">Débitos aprobados</dt>
                    <dd>
                      {s.approved_count}
                      {s.approved_count > 0 && s.total_paid_minor !== null ? ` · total ${formatAmount(s.total_paid_minor, s.paid_currency)}` : ""}
                    </dd>
                  </div>
                </dl>
                {debits.length > 0 ? (
                  <details className="mt-3">
                    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary-ink">Ver débitos ({debits.length})</summary>
                    <ul className="mt-1">{debits.map((d) => <DebitLine key={d.payment_id} d={d} />)}</ul>
                  </details>
                ) : (
                  <p className="mt-3 text-xs text-muted">Sin débitos registrados.</p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Filters({ view, q }: { view: View; q: string }) {
  return (
    <nav aria-label="Filtrar suscripciones" className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {FILTERS.map((f) => {
        const href = `/admin/suscripciones${f.view === "todas" ? "" : `?vista=${f.view}`}${q && f.view !== "debitos" ? `${f.view === "todas" ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`;
        const current = f.view === view;
        return (
          <Link
            key={f.view}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${current ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink hover:border-primary"}`}
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}
