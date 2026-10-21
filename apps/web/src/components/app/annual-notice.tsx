import { formatDate } from "@runner360/shared";
import Link from "next/link";
import { expiryNoticeDays } from "@/lib/payments/annual";

/** Aviso en toda la app desde 15 días antes de que venza el plan anual. */
export function AnnualExpiryNotice({ until, now = new Date() }: { until: string | null; now?: Date }) {
  const days = expiryNoticeDays(until ? new Date(until) : null, now);
  if (days === null || !until) return null;
  return (
    <aside role="status" className="mb-4 rounded-[var(--radius-card)] border border-warning bg-surface p-3 text-sm">
      <p>
        <strong>Tu plan anual vence en {days} {days === 1 ? "día" : "días"}</strong> (el {formatDate(until.slice(0, 10), "long")}). Después no vas a poder generar planes
        completos nuevos; tu historial se conserva.{" "}
        <Link href="/suscripcion" className="font-semibold text-primary-ink underline">Renovar</Link>
      </p>
    </aside>
  );
}
