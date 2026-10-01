import type { Metadata } from "next";
import { Check } from "lucide-react";
import { FEATURE_LABELS, formatDate, formatMoney, type Feature } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireOnboardedViewer } from "@/lib/auth";
import { getPublicCatalog } from "@/lib/data/pricing";
import { PROVIDERS } from "@/lib/payments/registry";
import { createClient } from "@/lib/supabase/server";
import { cancelSubscriptionAction, startCheckoutAction } from "./actions";

export const metadata: Metadata = { title: "Suscripción" };

const STATUS: Record<string, string> = {
  pending: "Pendiente", trialing: "Prueba", active: "Activa", past_due: "Pago pendiente", canceled: "Cancelada", expired: "Vencida",
};
const ERRORS: Record<string, string> = {
  pendiente: "La integración con este medio de pago está pendiente de configuración. No se realizó ningún cobro.",
  proveedor: "Medio de pago desconocido.",
  precio: "El precio seleccionado no está disponible.",
  moneda: "Ese medio de pago no admite la moneda del precio.",
  checkout: "No pudimos iniciar el pago. Intentá más tarde.",
  limite: "Demasiados intentos. Probá más tarde.",
  cancelacion: "No pudimos procesar la cancelación.",
};

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireOnboardedViewer("/app/suscripcion");
  const supabase = await createClient();
  const [catalog, { data: subs }] = await Promise.all([
    getPublicCatalog(),
    supabase
      .from("subscriptions")
      .select("id, provider, status, current_period_start, current_period_end, cancel_at_period_end, provider_subscription_id, subscription_products(name)")
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false }),
  ]);
  const premium = catalog?.find((p) => p.tier === "premium");
  const providers = Object.values(PROVIDERS);

  return (
    <>
      <PageHeader title="Suscripción" description="Tu plan actual y las opciones disponibles." />
      {sp.error && ERRORS[sp.error] ? <Alert tone="danger" className="mb-4">{ERRORS[sp.error]}</Alert> : null}
      {sp.checkout === "ok" ? <Alert tone="success" className="mb-4">Recibimos tu suscripción. La activación se confirma cuando el proveedor nos notifica el pago.</Alert> : null}
      {sp.cancelacion ? <Alert className="mb-4">Solicitamos la cancelación al proveedor. Vas a conservar el acceso hasta el fin del período pago.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Funciones habilitadas" />
          <ul className="space-y-2 text-sm">
            {viewer.features.map((f) => (
              <li key={f} className="flex gap-2"><Check className="size-5 text-success" aria-hidden /> {FEATURE_LABELS[f as Feature] ?? f}</li>
            ))}
          </ul>
          <h3 className="mb-2 mt-6 font-semibold text-navy">Historial</h3>
          {(subs ?? []).length === 0 ? (
            <p className="text-sm text-muted">Usás la versión gratuita.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {(subs ?? []).map((s) => (
                <li key={s.id as string} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{(s.subscription_products as unknown as { name: string })?.name}</span>
                    <Badge tone={s.status === "active" ? "success" : "neutral"}>{STATUS[s.status as string] ?? (s.status as string)}</Badge>
                    {s.cancel_at_period_end ? <Badge tone="warning">Se cancela al fin del período</Badge> : null}
                    <span className="text-xs text-muted">vía {s.provider === "manual" ? "alta manual" : (s.provider as string)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    {s.current_period_start ? `Desde ${formatDate(s.current_period_start as string)}` : ""}
                    {s.current_period_end ? ` · Renovación/fin: ${formatDate(s.current_period_end as string)}` : ""}
                  </p>
                  {s.status === "active" && s.provider !== "manual" && !s.cancel_at_period_end ? (
                    <form action={cancelSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={s.id as string} />
                      <SubmitButton variant="secondary" size="sm" pendingText="Procesando…">Cancelar renovación</SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={premium?.name ?? "Premium"} description={premium?.description} />
          {!premium || premium.prices.length === 0 ? (
            <Alert>Los precios de Premium todavía no están configurados.</Alert>
          ) : (
            <ul className="space-y-4">
              {premium.prices.map((price) => (
                <li key={price.id} className="rounded-xl border border-line p-4">
                  <p className="tabular text-xl font-bold text-navy">
                    {formatMoney(price.amountMinor, price.currency)} <span className="text-sm font-normal text-muted">{price.interval === "month" ? "por mes" : "por año"}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {providers.filter((p) => p.currencies.includes(price.currency)).map((p) => (
                      <form key={p.id} action={startCheckoutAction}>
                        <input type="hidden" name="priceId" value={price.id} />
                        <input type="hidden" name="provider" value={p.id} />
                        <SubmitButton size="sm" variant={p.isConfigured() ? "primary" : "secondary"} disabled={!p.isConfigured()} pendingText="Redirigiendo…">
                          {p.label}{p.isConfigured() ? "" : " · pendiente de configuración"}
                        </SubmitButton>
                      </form>
                    ))}
                    {providers.every((p) => !p.currencies.includes(price.currency)) ? (
                      <p className="text-sm text-muted">No hay medios de pago para {price.currency}.</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">
            Los pagos se procesan en el sitio del proveedor; RUNNER 360 no almacena datos de tarjetas. En la app móvil las
            compras se integrarán con App Store y Google Play cuando corresponda.
          </p>
        </Card>
      </div>
    </>
  );
}
