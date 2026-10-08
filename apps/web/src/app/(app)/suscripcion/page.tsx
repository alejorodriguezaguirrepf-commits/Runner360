import { formatDate, SUBSCRIPTION_STATUS_LABELS, type SubscriptionRow } from "@runner360/shared";
import type { Metadata } from "next";
import { IconCheck } from "@/components/ui/icons";
import { Alert, Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { hasPremium, requireOnboardedSession } from "@/lib/auth";
import { getPricedProducts } from "@/lib/data/pricing";
import { PROVIDERS } from "@/lib/payments/registry";
import { CancelSubscriptionForm, CheckoutForm } from "./billing-forms";

export const metadata: Metadata = { title: "Suscripción" };

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await requireOnboardedSession();
  const { estado } = await searchParams;
  const [products, premium, { data: subs }] = await Promise.all([
    getPricedProducts(session.supabase),
    hasPremium(session),
    session.supabase.from("subscriptions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const current = ((subs ?? []) as SubscriptionRow[])[0];
  const providers = Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
  const anyConfigured = providers.some((p) => p.configured);

  return (
    <>
      <PageHeader title="Suscripción" subtitle={premium ? "Tenés acceso Premium." : "Estás usando el plan Free."} />
      <div className="space-y-4">
        {estado === "procesando" ? <Alert tone="info" title="Estamos confirmando tu pago">El acceso se activa cuando el proveedor confirma la operación. Puede demorar unos minutos.</Alert> : null}
        {!anyConfigured ? (
          <Alert tone="warning" title="Pagos pendientes de configuración">
            Los medios de pago (Mercado Pago y tarjeta internacional) todavía no están habilitados en esta instalación. No se realizan cobros.
          </Alert>
        ) : null}
        {current ? (
          <Card>
            <CardTitle action={<Badge tone={premium ? "lime" : "neutral"}>{SUBSCRIPTION_STATUS_LABELS[current.status]}</Badge>}>Tu suscripción</CardTitle>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">Inicio</dt><dd className="font-semibold">{current.started_at ? formatDate(current.started_at.slice(0, 10), "long") : "—"}</dd></div>
              <div><dt className="text-muted">{current.cancel_at_period_end || current.status === "cancelled" ? "Acceso hasta" : "Próxima renovación"}</dt><dd className="font-semibold">{current.current_period_end ? formatDate(current.current_period_end.slice(0, 10), "long") : "—"}</dd></div>
              <div><dt className="text-muted">Medio</dt><dd className="font-semibold">{current.provider === "manual" ? "Otorgado por el equipo" : current.provider}</dd></div>
            </dl>
            {premium && !current.cancel_at_period_end && current.status !== "cancelled" ? <div className="mt-4"><CancelSubscriptionForm /></div> : null}
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {(products ?? []).filter((p) => p.tier === "premium").map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.name}</CardTitle>
              <p className="tabular text-2xl font-extrabold">{p.priceLabel ?? "Precio a definir"}{p.priceLabel ? <span className="text-sm font-medium text-muted"> / {p.billing_interval === "year" ? "año" : "mes"}</span> : null}</p>
              <ul className="my-4 space-y-1.5 text-sm">
                {p.features.map((f) => <li key={f} className="flex gap-2"><IconCheck className="mt-0.5 shrink-0 text-lime-700" />{f}</li>)}
              </ul>
              {!premium ? <CheckoutForm productId={p.id} providers={providers.filter((pr) => p.prices.some((price) => price.provider === pr.id))} /> : null}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
