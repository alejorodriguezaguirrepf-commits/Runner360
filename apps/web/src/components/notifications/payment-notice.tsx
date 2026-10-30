import type { SupabaseClient } from "@supabase/supabase-js";
import { IconAlert, IconCheck } from "@/components/ui/icons";
import { markNoticeSeenAction } from "@/lib/actions/notifications";

type Notice = { id: string; kind: "payment_failed" | "payment_recovered" | "access_ended"; message: string; action_url: string | null; resolved_at: string | null; seen_at: string | null };

/**
 * Cartel de pagos arriba de la app: visible en todas las pantallas, sin bloquear el uso.
 *  - Débito rechazado (hasta que se regularice o termine la gracia): no se puede cerrar.
 *  - Pago regularizado o acceso pausado: se cierra con "Entendido".
 */
async function recentNotices(supabase: SupabaseClient, userId: string): Promise<Notice[]> {
  const { data } = await supabase
    .from("user_notices")
    .select("id, kind, message, action_url, resolved_at, seen_at")
    .eq("user_id", userId)
    .gt("created_at", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as Notice[];
}

export async function PaymentNotice({ supabase, userId }: { supabase: SupabaseClient; userId: string }) {
  const notices = await recentNotices(supabase, userId);
  const failed = notices.find((n) => n.kind === "payment_failed" && !n.resolved_at);
  const info = failed ? null : notices.find((n) => n.kind !== "payment_failed" && !n.seen_at);
  if (failed) {
    return (
      <div role="alert" className="mb-6 flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-bg p-4 text-ink sm:flex-row sm:items-center">
        <IconAlert className="hidden shrink-0 text-warning sm:block" />
        <p className="flex-1 text-sm">{failed.message}</p>
        {failed.action_url ? (
          <a href={failed.action_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
            Actualizar medio de pago
          </a>
        ) : null}
      </div>
    );
  }
  if (!info) return null;
  const ok = info.kind === "payment_recovered";
  return (
    <div role="status" className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 text-ink sm:flex-row sm:items-center ${ok ? "border-success/40 bg-success-bg" : "border-danger/40 bg-danger-bg"}`}>
      {ok ? <IconCheck className="hidden shrink-0 text-success sm:block" /> : <IconAlert className="hidden shrink-0 text-danger sm:block" />}
      <p className="flex-1 text-sm">{info.message}</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!ok && info.action_url ? (
          <a href={info.action_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
            Actualizar medio de pago
          </a>
        ) : null}
        <form action={markNoticeSeenAction}>
          <input type="hidden" name="id" value={info.id} />
          <button type="submit" className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink">Entendido</button>
        </form>
      </div>
    </div>
  );
}
