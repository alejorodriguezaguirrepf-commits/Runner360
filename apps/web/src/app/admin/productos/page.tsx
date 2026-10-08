import { formatMoney, type PriceRow, type ProductRow } from "@runner360/shared";
import type { Metadata } from "next";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { deactivatePriceAction, toggleFeatureAction, toggleProductAction } from "@/lib/actions/admin";
import { PriceForm } from "./price-form";

export const metadata: Metadata = { title: "Productos y precios" };

export default async function ProductsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: prices }, { data: features }] = await Promise.all([
    supabase.from("subscription_products").select("*").order("sort_order"),
    supabase.from("product_prices").select("*").order("created_at", { ascending: false }),
    supabase.from("app_features").select("*").order("key"),
  ]);
  return (
    <>
      <PageHeader title="Productos y precios" subtitle="Los importes se guardan en unidades menores (centavos). Cambiar un precio desactiva el anterior y queda auditado." />
      <div className="space-y-4">
        {((products ?? []) as ProductRow[]).map((p) => {
          const own = ((prices ?? []) as PriceRow[]).filter((pr) => pr.product_id === p.id);
          return (
            <Card key={p.id}>
              <CardTitle
                action={
                  <form action={toggleProductAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold">{p.active ? "Desactivar producto" : "Activar producto"}</button>
                  </form>
                }
              >
                {p.name} <Badge tone={p.tier === "premium" ? "navy" : "neutral"}>{p.tier}</Badge> {p.billing_interval ? <Badge>{p.billing_interval === "month" ? "mensual" : "anual"}</Badge> : null} {!p.active ? <Badge tone="danger">inactivo</Badge> : null}
              </CardTitle>
              {p.tier === "premium" ? (
                <>
                  <table className="mb-4 w-full text-left text-sm">
                    <thead className="text-muted"><tr><th className="py-1">Importe</th><th>Proveedor</th><th>ID en proveedor</th><th>Estado</th><th /></tr></thead>
                    <tbody className="divide-y divide-line">
                      {own.length === 0 ? <tr><td colSpan={5} className="py-2 text-muted">Sin precios. Se muestra “Precio a definir”.</td></tr> : own.map((pr) => (
                        <tr key={pr.id}>
                          <td className="tabular py-1.5 font-semibold">{formatMoney(pr.amount_minor, pr.currency)}</td>
                          <td>{pr.provider ?? "Precio de lista"}</td>
                          <td className="font-mono text-xs">{pr.provider_price_id ?? "—"}</td>
                          <td>{pr.active ? <Badge tone="success">activo</Badge> : <Badge>inactivo</Badge>}</td>
                          <td>{pr.active ? <form action={deactivatePriceAction}><input type="hidden" name="id" value={pr.id} /><button className="text-xs font-semibold text-danger">Desactivar</button></form> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PriceForm productId={p.id} />
                </>
              ) : <p className="text-sm text-muted">Producto gratuito.</p>}
            </Card>
          );
        })}
        <Card>
          <CardTitle>Funcionalidades Premium</CardTitle>
          <p className="mb-3 text-sm text-muted">Define qué módulos requieren Premium. Se aplica también en la base de datos (RLS).</p>
          <ul className="divide-y divide-line text-sm">
            {((features ?? []) as { key: string; label: string; requires_premium: boolean }[]).map((f) => (
              <li key={f.key} className="flex items-center justify-between py-2">
                <span>{f.label} <span className="font-mono text-xs text-muted">({f.key})</span></span>
                <form action={toggleFeatureAction} className="flex items-center gap-2">
                  <input type="hidden" name="key" value={f.key} />
                  <input type="hidden" name="requiresPremium" value={String(!f.requires_premium)} />
                  <Badge tone={f.requires_premium ? "navy" : "success"}>{f.requires_premium ? "Premium" : "Gratis"}</Badge>
                  <button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold">Cambiar</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
