import type { Metadata } from "next";
import { FEATURE_LABELS, FEATURES, formatDate, formatMoney } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { PROVIDERS } from "@/lib/payments/registry";
import { createClient } from "@/lib/supabase/server";
import { addPriceAction, deactivatePriceAction, updateProductAction } from "./actions";

export const metadata: Metadata = { title: "Productos y precios" };

type Price = { id: string; currency: string; amount_minor: number; billing_interval: string; active: boolean; created_at: string; provider_price_ids: Record<string, string> };
type Product = { id: string; code: string; name: string; description: string; tier: string; features: string[]; active: boolean; subscription_prices: Price[] };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("subscription_products").select("id, code, name, description, tier, features, active, subscription_prices(id, currency, amount_minor, billing_interval, active, created_at, provider_price_ids)").order("sort_order");
  return (
    <>
      <PageHeader title="Productos y precios" description="Los precios no están en el código: se administran aquí. Los cambios quedan auditados." />
      {sp.error ? <Alert tone="danger" className="mb-4">Datos inválidos ({sp.error}).</Alert> : null}
      <Card className="mb-4">
        <CardHeader title="Estado de integración de pagos" />
        <ul className="flex flex-wrap gap-2">
          {Object.values(PROVIDERS).map((p) => <li key={p.id}><Badge tone={p.isConfigured() ? "success" : "warning"}>{p.label}: {p.isConfigured() ? "configurado" : "pendiente de configuración"}</Badge></li>)}
          <li><Badge tone="warning">App Store / Google Play: pendiente</Badge></li>
        </ul>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {((data ?? []) as Product[]).map((p) => (
          <Card key={p.id}>
            <CardHeader title={`${p.name} (${p.code})`} description={p.tier === "premium" ? "Producto Premium" : "Producto gratuito"} />
            <form action={updateProductAction} className="space-y-3">
              <input type="hidden" name="productId" value={p.id} />
              <Field label="Nombre" htmlFor={`pn-${p.id}`}><Input id={`pn-${p.id}`} name="name" defaultValue={p.name} /></Field>
              <Field label="Descripción" htmlFor={`pd-${p.id}`}><Textarea id={`pd-${p.id}`} name="description" defaultValue={p.description} className="min-h-16" /></Field>
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1 text-sm font-medium text-navy">Funcionalidades incluidas</legend>
                {FEATURES.map((f) => <Checkbox key={f} id={`f-${p.id}-${f}`} name="features" value={f} defaultChecked={p.features.includes(f)} label={FEATURE_LABELS[f]} />)}
              </fieldset>
              <Checkbox id={`a-${p.id}`} name="active" defaultChecked={p.active} label="Activo" />
              <SubmitButton size="sm">Guardar producto</SubmitButton>
            </form>
            <h3 className="mb-2 mt-6 font-semibold text-navy">Precios</h3>
            <ul className="divide-y divide-line text-sm">
              {p.subscription_prices.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((pr) => (
                <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="tabular">{formatMoney(Number(pr.amount_minor), pr.currency)} / {pr.billing_interval === "month" ? "mes" : "año"}
                    <span className="block text-xs text-muted">desde {formatDate(pr.created_at)}{pr.provider_price_ids?.stripe ? ` · Stripe ${pr.provider_price_ids.stripe}` : ""}</span></span>
                  {pr.active ? (
                    <form action={deactivatePriceAction}><input type="hidden" name="priceId" value={pr.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">Desactivar</SubmitButton></form>
                  ) : <Badge>Inactivo</Badge>}
                </li>
              ))}
            </ul>
            {p.tier === "premium" ? (
              <form action={addPriceAction} className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface p-3">
                <input type="hidden" name="productId" value={p.id} />
                <Field label="Importe" htmlFor={`am-${p.id}`} hint="Ej.: 7,99"><Input id={`am-${p.id}`} name="amount" inputMode="decimal" required /></Field>
                <Field label="Moneda" htmlFor={`cu-${p.id}`}><Select id={`cu-${p.id}`} name="currency"><option>USD</option><option>ARS</option></Select></Field>
                <Field label="Período" htmlFor={`in-${p.id}`}><Select id={`in-${p.id}`} name="interval"><option value="month">Mensual</option><option value="year">Anual</option></Select></Field>
                <Field label="Stripe price id (opcional)" htmlFor={`sp-${p.id}`}><Input id={`sp-${p.id}`} name="stripePriceId" /></Field>
                <div className="col-span-2"><SubmitButton size="sm">Agregar precio (reemplaza el activo equivalente)</SubmitButton></div>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
