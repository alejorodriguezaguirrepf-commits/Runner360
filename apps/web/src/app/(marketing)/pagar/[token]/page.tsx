import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { getPricedProducts } from "@/lib/data/pricing";
import { EMAIL_PLANS, isEmailPlan } from "@/lib/payments/email-pay";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Pagar la suscripción", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Link de pago de los correos: muestra el plan elegido y pasa solo a Mercado Pago (sin iniciar sesión).
 * El pago se hace recién al tocar o al abrirse la página en el navegador (no con un simple vistazo del
 * programa de correo).
 */
export default async function PayFromEmailPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ plan?: string }> }) {
  const { token } = await params;
  const { plan: raw } = await searchParams;
  const plan = isEmailPlan(raw) ? raw : "mensual";
  const products = await getPricedProducts(createAdminClient());
  const product = products?.find((p) => p.code === EMAIL_PLANS[plan]) ?? null;
  const other = plan === "mensual" ? "anual" : "mensual";
  const price = product?.priceLabel ?? null;

  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Suscripción a RUNNER 360</p>
        <h1 className="mt-1 text-2xl font-extrabold">{plan === "mensual" ? "Plan mensual" : "Plan anual"}</h1>
        {price ? (
          <p className="tabular mt-2 text-3xl font-extrabold">
            {price}
            <span className="text-base font-medium text-muted"> {plan === "mensual" ? "/ mes" : "/ año"}</span>
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          {plan === "mensual"
            ? "Débito automático por Mercado Pago. Cada mes pago libera el mes siguiente de tu plan. Cancelás cuando quieras."
            : "Un solo pago por Mercado Pago: 12 meses con tu plan completo desde el primer día, sin renovación automática."}
        </p>
        <div className="mt-5">
          <PayForm token={token} plan={plan} label={`Pagar ${price ?? ""} con Mercado Pago`.replace("  ", " ")} />
        </div>
        <p className="mt-4 text-sm">
          <Link href={`/pagar/${token}?plan=${other}`} className="font-semibold text-primary-ink underline">
            Prefiero el plan {other}
          </Link>
        </p>
        <p className="mt-6 text-xs text-muted">
          ¿Ya tenés tu cuenta abierta?{" "}
          <Link href="/ingresar" className="underline">Iniciá sesión</Link> y suscribite desde la app.
        </p>
      </Card>
    </section>
  );
}
