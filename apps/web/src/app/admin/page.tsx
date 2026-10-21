import { DISTANCE_LABELS } from "@runner360/shared";
import type { Metadata } from "next";
import { BarChart, type BarDatum } from "@/components/charts/bar-chart";
import { Alert, Card, CardTitle, PageHeader, Stat } from "@/components/ui/primitives";
import { startViewAsAction } from "@/lib/actions/view-as";
import { requireAdmin } from "@/lib/auth";
import { isServiceRoleConfigured } from "@/lib/env.server";
import { formatListPrice } from "@/lib/money";
import { PROVIDERS } from "@/lib/payments/registry";

export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };

type Dashboard = {
  users_total: number;
  users_this_week: number;
  users_this_month: number;
  users_by_week: { week: string; count: number }[];
  users_by_month: { month: string; count: number }[];
  subs: { active: number; cancelled: number; expired: number; pending: number };
  subs_by_plan: { plan: string; active: number }[];
  subs_by_interval?: Partial<Record<"month" | "year", { active: number; expiring_15d: number; ended: number }>>;
  revenue_by_interval?: { interval: "month" | "year"; currency: string; amount_minor: number; payments: number }[];
  revenue_by_month: { month: string; currency: string; amount_minor: number }[];
  payments_count: number;
  payment_events_count: number;
  payment_events_failed: number;
  distances: { distance: string; count: number }[];
  calculator: { users: number; last_30d: number };
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const monthLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(2, 4)}`;
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** Últimos 12 meses (aaaa-mm-01), del más viejo al actual, en hora argentina. */
function lastMonths(n: number): string[] {
  const now = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_dashboard");
  const d = data as Dashboard | null;

  const months = lastMonths(12);
  const thisMonth = months[months.length - 1]!;
  const prevMonth = months[months.length - 2]!;
  const currencies = [...new Set((d?.revenue_by_month ?? []).map((r) => r.currency))].sort();
  const amount = (cur: string, month?: string) =>
    (d?.revenue_by_month ?? []).filter((r) => r.currency === cur && (!month || r.month === month)).reduce((a, r) => a + Number(r.amount_minor), 0);

  return (
    <>
      <PageHeader title="Panel de administración" subtitle="Usuarios, suscripciones, ingresos y uso de la app." />

      <Card className="mb-6">
        <CardTitle>Ver la app como usuario</CardTitle>
        <p className="mb-3 text-sm text-muted">Revisá la experiencia real sin salir de tu cuenta. Arriba vas a ver un aviso para volver.</p>
        <div className="flex flex-wrap gap-2">
          <form action={startViewAsAction}>
            <input type="hidden" name="mode" value="free" />
            <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">Sin suscripción</button>
          </form>
          <form action={startViewAsAction}>
            <input type="hidden" name="mode" value="premium" />
            <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-2">Con suscripción</button>
          </form>
        </div>
      </Card>

      {error || !d ? (
        <Alert tone="danger">No se pudieron cargar las estadísticas.</Alert>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="usuarios" className="space-y-3">
            <h2 id="usuarios" className="text-xl font-extrabold">Usuarios</h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Registrados" value={String(d.users_total)} />
              <Stat label="Nuevos esta semana" value={String(d.users_this_week)} />
              <Stat label="Nuevos este mes" value={String(d.users_this_month)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardTitle>Nuevos por semana</CardTitle>
                <BarChart
                  title="Usuarios nuevos por semana"
                  unitLabel="Usuarios"
                  data={d.users_by_week.map((w, i, all): BarDatum => ({ key: w.week, label: dayLabel(w.week), value: w.count, display: String(w.count), highlight: i === all.length - 1 }))}
                />
              </Card>
              <Card>
                <CardTitle>Nuevos por mes</CardTitle>
                <BarChart
                  title="Usuarios nuevos por mes"
                  unitLabel="Usuarios"
                  data={d.users_by_month.map((m, i, all): BarDatum => ({ key: m.month, label: monthLabel(m.month), value: m.count, display: String(m.count), highlight: i === all.length - 1 }))}
                />
              </Card>
            </div>
          </section>

          <section aria-labelledby="suscripciones" className="space-y-3">
            <h2 id="suscripciones" className="text-xl font-extrabold">Suscripciones</h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Activas" value={String(d.subs.active)} />
              <Stat label="Canceladas" value={String(d.subs.cancelled)} />
              <Stat label="Vencidas" value={String(d.subs.expired)} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {(["month", "year"] as const).map((interval) => {
                const x = d.subs_by_interval?.[interval];
                const income = (d.revenue_by_interval ?? []).filter((r) => r.interval === interval);
                return (
                  <Card key={interval}>
                    <CardTitle>{interval === "year" ? "Suscriptores anuales" : "Suscriptores mensuales"}</CardTitle>
                    <div className="grid grid-cols-3 gap-3">
                      <Stat label="Activos" value={String(x?.active ?? 0)} />
                      {interval === "year" ? <Stat label="Vencen en 15 días" value={String(x?.expiring_15d ?? 0)} /> : <Stat label="Pagos" value={String(income.reduce((a, r) => a + r.payments, 0))} />}
                      <Stat label={interval === "year" ? "Vencidos" : "Terminados"} value={String(x?.ended ?? 0)} />
                    </div>
                    <p className="mt-3 text-sm">
                      <span className="text-muted">Ingresos acumulados: </span>
                      <span className="tabular font-semibold">{income.length ? income.map((r) => formatListPrice(Number(r.amount_minor), r.currency)).join(" · ") : "—"}</span>
                    </p>
                  </Card>
                );
              })}
            </div>
            <Card>
              <CardTitle>Activas por plan</CardTitle>
              <ul className="divide-y divide-line text-sm">
                {d.subs_by_plan.map((p) => (
                  <li key={p.plan} className="flex justify-between py-2"><span>{p.plan}</span><span className="tabular font-semibold">{p.active}</span></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">No incluye el acceso otorgado a mano ni el del administrador (que no paga).</p>
            </Card>
          </section>

          <section aria-labelledby="ingresos" className="space-y-3">
            <h2 id="ingresos" className="text-xl font-extrabold">Ingresos</h2>
            {d.payments_count === 0 ? (
              <Alert tone="info" title="Todavía no hay cobros registrados">
                Los cobros se guardan cuando Mercado Pago avisa cada débito a la app. Para que lleguen faltan: las credenciales de Mercado Pago en
                Vercel (MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y MP_ENV) y cargar en Mercado Pago (Tus integraciones → Webhooks) la dirección
                https://runner360.vercel.app/api/webhooks/mercadopago con los eventos de suscripciones y de pagos de suscripciones.
                Avisos recibidos hasta ahora: {d.payment_events_count}.
              </Alert>
            ) : null}
            {currencies.length === 0 ? (
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Este mes" value="—" />
                <Stat label="Mes anterior" value="—" />
                <Stat label="Acumulado" value="—" />
              </div>
            ) : (
              currencies.map((cur) => (
                <Card key={cur}>
                  <CardTitle>Ingresos en {cur}</CardTitle>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <Stat label="Este mes" value={formatListPrice(amount(cur, thisMonth), cur)} />
                    <Stat label="Mes anterior" value={formatListPrice(amount(cur, prevMonth), cur)} />
                    <Stat label="Acumulado" value={formatListPrice(amount(cur), cur)} />
                  </div>
                  <BarChart
                    title={`Ingresos por mes en ${cur}`}
                    unitLabel={cur}
                    data={months.map((m, i): BarDatum => ({ key: m, label: monthLabel(m), value: amount(cur, m) / 100, display: formatListPrice(amount(cur, m), cur), highlight: i === months.length - 1 }))}
                  />
                </Card>
              ))
            )}
            {d.payment_events_failed > 0 ? <Alert tone="warning">Hay {d.payment_events_failed} avisos de pago con error. Revisalos en Supabase (payment_events).</Alert> : null}
          </section>

          <section aria-labelledby="uso" className="grid gap-4 lg:grid-cols-2">
            <h2 id="uso" className="sr-only">Uso de la app</h2>
            <Card>
              <CardTitle>Distancias objetivo más elegidas</CardTitle>
              {d.distances.length ? (
                <ul className="divide-y divide-line text-sm">
                  {d.distances.map((x) => (
                    <li key={x.distance} className="flex justify-between py-2">
                      <span>{DISTANCE_LABELS[x.distance as keyof typeof DISTANCE_LABELS] ?? x.distance}</span>
                      <span className="tabular font-semibold">{x.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Sin datos todavía.</p>
              )}
            </Card>
            <Card>
              <CardTitle>Calculadora de ritmos</CardTitle>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Personas con test guardado" value={String(d.calculator.users)} />
                <Stat label="Usada en 30 días" value={String(d.calculator.last_30d)} />
              </div>
            </Card>
          </section>

          <Card>
            <CardTitle>Estado de integraciones</CardTitle>
            <ul className="space-y-2 text-sm">
              {Object.values(PROVIDERS).map((p) => (
                <li key={p.id} className="flex justify-between gap-3"><span>{p.label}</span><span className={p.isConfigured() ? "text-success" : "text-warning"}>{p.isConfigured() ? "Configurado" : "Pendiente de configuración"}</span></li>
              ))}
              <li className="flex justify-between gap-3"><span>Clave de servicio (webhooks, eliminación de cuentas)</span><span className={isServiceRoleConfigured() ? "text-success" : "text-warning"}>{isServiceRoleConfigured() ? "Configurada" : "Pendiente"}</span></li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
