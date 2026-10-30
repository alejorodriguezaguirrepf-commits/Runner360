import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { failureReason, formatAmount, formatDateTime } from "@/lib/notifications/payment-texts";

export const metadata: Metadata = { title: "Pagos con problemas", robots: { index: false, follow: false } };

type Problem = {
  payment_id: string;
  provider_payment_id: string;
  failed_at: string;
  failure_code: string | null;
  amount_minor: number | null;
  currency: string | null;
  user_id: string;
  email: string;
  display_name: string | null;
  plan: string | null;
  subscription_status: string | null;
  grace_until: string | null;
  resolved: boolean;
};

function state(p: Problem): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (p.resolved || p.subscription_status === "active") return { label: "Regularizado", tone: "success" };
  if (p.subscription_status === "past_due") return { label: p.grace_until ? `En gracia hasta ${formatDateTime(p.grace_until)}` : "En gracia", tone: "warning" };
  if (p.subscription_status === "expired") return { label: "Acceso cortado", tone: "danger" };
  return { label: p.subscription_status ?? "Sin suscripción", tone: "neutral" };
}

/** Débitos rechazados de los últimos 90 días y en qué quedó cada caso. */
export default async function PaymentProblemsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_payment_problems");
  const rows = (data ?? []) as Problem[];
  const open = rows.filter((r) => !r.resolved && r.subscription_status !== "active").length;
  return (
    <>
      <PageHeader title="Pagos con problemas" subtitle={`Débitos rechazados de los últimos 90 días · ${open} sin resolver.`} />
      {error ? <p className="text-sm text-danger">No pudimos cargar el listado.</p> : null}
      {rows.length === 0 ? (
        <EmptyState title="Sin débitos rechazados" />
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const s = state(p);
            return (
              <li key={p.payment_id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{p.display_name ?? "Sin nombre"} · {p.email}</p>
                      <p className="text-sm text-muted">
                        {p.plan ?? "Premium"} · {formatAmount(p.amount_minor, p.currency)} · {formatDateTime(p.failed_at)}
                      </p>
                      <p className="mt-1 text-sm text-ink">Motivo: {failureReason(p.failure_code)}{p.failure_code ? <span className="text-muted"> ({p.failure_code})</span> : null}</p>
                      <p className="text-xs text-muted">Pago MP {p.provider_payment_id}</p>
                    </div>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <Link href={`/admin/usuarios?q=${encodeURIComponent(p.email)}`} className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold text-primary-ink">
                    Ver usuario
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
