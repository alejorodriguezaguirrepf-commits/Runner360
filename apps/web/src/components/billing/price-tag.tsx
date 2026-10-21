import { fmt } from "@/i18n";
import { pricing as m } from "@/i18n/es-AR/pricing";
import type { PricedProduct } from "@/lib/data/pricing";
import { cx } from "@/components/ui/primitives";

/**
 * Precio de un producto: importe de lista (US$), equivalente aproximado en pesos y la leyenda.
 * `inverse`: sobre fondo oscuro de la navegación (portada).
 */
export function PriceTag({ product, inverse = false, size = "lg" }: { product: PricedProduct; inverse?: boolean; size?: "lg" | "md" }) {
  const yearly = product.billing_interval === "year";
  const muted = inverse ? "text-nav-muted" : "text-muted";
  if (!product.priceLabel) return <p className={cx("tabular font-extrabold", size === "lg" ? "text-3xl" : "text-2xl")}>{m.toDefine}</p>;
  return (
    <div>
      <p className={cx("tabular font-extrabold", size === "lg" ? "text-3xl" : "text-2xl")}>
        {product.priceLabel}
        <span className={cx("text-base font-medium", muted)}> {yearly ? m.perYear : m.perMonth}</span>
      </p>
      {product.savings ? (
        <p className={cx("mt-2 inline-block rounded-lg px-2.5 py-1 text-sm font-bold", inverse ? "bg-accent text-on-accent" : "bg-primary text-on-primary")}>
          {fmt(m.savings, { amount: product.savings.label, pct: product.savings.pct })}
        </p>
      ) : null}
      {product.ars ? (
        <>
          <p className="tabular mt-1 font-semibold">
            {fmt(m.arsApprox, { ars: product.ars.label, period: yearly ? m.arsPeriodYear : m.arsPeriodMonth })}
          </p>
          <p className={cx("mt-1 text-xs", muted)}>
            {m.legend}
            {product.ars.rateNote ? ` ${product.ars.rateNote}` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
