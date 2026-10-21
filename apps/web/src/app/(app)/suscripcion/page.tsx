import { formatDate, SUBSCRIPTION_STATUS_LABELS, type SubscriptionRow } from "@runner360/shared";
import type { Metadata } from "next";
import { PriceTag } from "@/components/billing/price-tag";
import { IconCheck } from "@/components/ui/icons";
import { pricing } from "@/i18n/es-AR/pricing";
import { Alert, Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { annualAccessUntil, hasPremium, requireOnboardedSession } from "@/lib/auth";
import { checkoutAvailable, getPricedProducts } from "@/lib/data/pricing";
import { PROVIDERS } from "@/lib/payments/registry";
import { CancelSubscriptionForm, CheckoutForm } from "./billing-forms";

export const metadata: Metadata = { title: "Suscripción" };

const PAYMENT_LABELS: Record<string, string> = { approved: "Aprobado · mes liberado", pending: "En proceso", rejected: "Rechazado", refunded: "Devuelto" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await requireOnboardedSession();
  const { estado } = await searchParams;
  const [products, premium, annualUntil, { data: subs }, { data: payments }] = await Promise.all([
    getPricedProducts(session.supabase),
    hasPremium(session),
    annualAccessUntil(session),
    session.supabase.from("subscriptions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(5),
    session.supabase.from("subscription_payments").select("id, status, paid_at, subscription_id").eq("user_id", session.user.id).order("paid_at", { ascending: false }).limit(12),
  ]);
  const yearlyIds = new Set((products ?? []).filter((p) => p.billing_interval === "year").map((p) => p.id));
  const current = ((subs ?? []) as SubscriptionRow[])[0];
  const currentIsAnnual = current ? yearlyIds.has(current.product_id) : false;
  const annualSubIds = new Set(((subs ?? []) as SubscriptionRow[]).filter((x) => yearlyIds.has(x.product_id)).map((x) => x.id));
  const monthlyActive = premium && !annualUntil && Boolean(current) && !currentIsAnnual && current?.provider !== "manual";
  const providers = Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
  const anyConfigured = providers.some((p) => p.configured);
  const premiumProducts = (products ?? []).filter((p) => p.tier === "premium" && (p.billing_interval === "month" || p.billing_interval === "year"));

  return (
    <>
      <PageHeader
        title="Suscripción"
        subtitle={annualUntil ? `Plan anual activo hasta el ${formatDate(annualUntil.slice(0, 10), "long")}.` : premium ? "Tu suscripción está activa." : "Estás usando el plan gratis."}
      />
      <div className="space-y-4">
        <Alert tone="info" title="Cómo funciona">
          <strong>Mensual:</strong> se renueva sola cada mes con débito automático y cada débito libera el mes siguiente de tu plan (4 semanas).{" "}
          <strong>Anual:</strong> un único pago por 12 meses, sin renovación automática. Durante el año elegís cualquier plan, lo ves completo desde el
          primer día y, al terminarlo, lo renovás o elegís otro sin volver a pagar.
        </Alert>
        {estado === "procesando" ? <Alert tone="info" title="Estamos confirmando tu pago">El acceso se activa cuando el proveedor confirma la operación. Puede demorar unos minutos.</Alert> : null}
        {!anyConfigured ? (
          <Alert tone="warning" title="Pagos pendientes de configuración">
            Los medios de pago (Mercado Pago y tarjeta internacional) todavía no están habilitados en esta instalación. No se realizan cobros.
          </Alert>
        ) : null}
        {current ? (
          <Card>
            <CardTitle action={<Badge tone={premium ? "lime" : "neutral"}>{currentIsAnnual ? (premium ? "Anual activo" : "Anual vencido") : SUBSCRIPTION_STATUS_LABELS[current.status]}</Badge>}>
              Tu suscripción
            </CardTitle>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Inicio</dt><dd className="font-semibold">{current.started_at ? formatDate(current.started_at.slice(0, 10), "long") : "—"}</dd></div>
              <div>
                <dt className="text-muted">{currentIsAnnual || current.cancel_at_period_end || current.status === "cancelled" ? "Acceso hasta" : "Próxima renovación"}</dt>
                <dd className="font-semibold">
                  {annualUntil ? formatDate(annualUntil.slice(0, 10), "long") : current.current_period_end ? formatDate(current.current_period_end.slice(0, 10), "long") : "—"}
                </dd>
              </div>
              <div><dt className="text-muted">Medio</dt><dd className="font-semibold">{current.provider === "manual" ? "Otorgado por el equipo" : current.provider === "mercadopago" ? "Mercado Pago" : current.provider}</dd></div>
            </dl>
            {premium && !currentIsAnnual && !current.cancel_at_period_end && current.status !== "cancelled" ? <div className="mt-4"><CancelSubscriptionForm /></div> : null}
          </Card>
        ) : null}
        {payments && payments.length ? (
          <Card>
            <CardTitle>Pagos</CardTitle>
            <ul className="divide-y divide-line text-sm">
              {(payments as { id: string; status: string; paid_at: string; subscription_id: string | null }[]).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{formatDate(p.paid_at.slice(0, 10), "long")}</span>
                  <Badge tone={p.status === "approved" ? "success" : p.status === "pending" ? "neutral" : "danger"}>{p.status === "approved" && p.subscription_id && annualSubIds.has(p.subscription_id) ? "Aprobado · plan anual" : (PAYMENT_LABELS[p.status] ?? p.status)}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {premiumProducts.map((p) => {
            const yearly = p.billing_interval === "year";
            // Mensual: solo sin Premium. Anual: sin Premium o para renovar el anual (se encadena).
            const canBuy = yearly ? !premium || Boolean(annualUntil) : !premium;
            return (
              <Card key={p.id} className={yearly ? "border-primary" : undefined}>
                <CardTitle action={yearly ? <Badge tone="lime">Recomendado</Badge> : null}>{p.name}</CardTitle>
                <PriceTag product={p} size="md" />
                <p className="mt-2 text-sm font-semibold">{yearly ? pricing.renewalYear : pricing.renewal}</p>
                <ul className="my-4 space-y-1.5 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><IconCheck className="mt-0.5 shrink-0 text-primary-ink" />{f}</li>)}
                </ul>
                {canBuy ? (
                  <CheckoutForm
                    productId={p.id}
                    label={yearly && annualUntil ? "Renovar el plan anual" : undefined}
                    providers={providers.filter((pr) => checkoutAvailable(p, pr.id) && (!yearly || pr.id === "mercadopago"))}
                  />
                ) : yearly && monthlyActive ? (
                  <p className="text-sm text-muted">Para pasar al anual, primero cancelá la renovación mensual. Cuando termine el mes pago, comprás el anual desde acá.</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
