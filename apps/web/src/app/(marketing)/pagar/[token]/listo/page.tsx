import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { payUserFromToken } from "@/lib/payments/email-pay";
import { confirmCheckoutReturn } from "@/lib/payments/process";
import { getProvider } from "@/lib/payments/registry";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Pago de la suscripción", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Vuelta de Mercado Pago después de pagar desde el correo: se confirma el pago en el momento. */
export default async function PayDonePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string"));
  const cancelled = qs.get("cancelado") === "1" || ["rejected", "null"].includes(qs.get("status") ?? qs.get("collection_status") ?? "");
  let outcome: "active" | "pending" | "ignored" = "ignored";
  const admin = createAdminClient();
  if (!cancelled && admin && (qs.get("preapproval_id") || qs.get("payment_id")) && rateLimit(`email-pay-return:${token}`, 10, 60_000).ok) {
    const who = await payUserFromToken(admin, token);
    if (who) outcome = await confirmCheckoutReturn(getProvider("mercadopago"), qs, who.userId, admin);
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <Card>
        {cancelled ? (
          <>
            <h1 className="text-2xl font-extrabold">El pago no se completó</h1>
            <p className="mt-2 text-muted">No se te cobró nada. Podés intentarlo de nuevo cuando quieras.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/pagar/${token}?plan=mensual`} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-on-primary">Pagar el plan mensual</Link>
              <Link href={`/pagar/${token}?plan=anual`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 font-semibold text-ink">Pagar el plan anual</Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">{outcome === "active" ? "¡Listo, ya tenés tu suscripción!" : "¡Gracias! Estamos confirmando tu pago"}</h1>
            <p className="mt-2 text-muted">
              {outcome === "active"
                ? "Tu plan ya está liberado. Entrá a la app para seguir entrenando."
                : "Mercado Pago nos avisa en unos minutos y tu plan se libera solo. Entrá a la app para verlo."}
            </p>
            <Link href="/inicio" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-semibold text-on-primary">Ir a la app</Link>
          </>
        )}
      </Card>
    </section>
  );
}
