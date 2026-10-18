import { DISTANCE_LABELS, formatDate, ROLE_LABELS, type ProfileRow } from "@runner360/shared";
import type { Metadata } from "next";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { grantManualPremiumAction, revokeManualPremiumAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Usuarios", robots: { index: false, follow: false } };

type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: ProfileRow["role"];
  created_at: string;
  target_distance: string | null;
  plan: string;
  subscription_status: string | null;
  total_count: number;
};

const SIZE = 25;

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { q = "", pagina = "1" } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const { data, error } = await supabase.rpc("admin_users", { p_query: q.trim().slice(0, 100), p_limit: SIZE, p_offset: (page - 1) * SIZE });
  const users = (data ?? []) as AdminUser[];
  const total = users[0]?.total_count ?? 0;
  const ids = users.map((u) => u.id);
  const [{ data: perms }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("id, can_validate_plans").in("id", ids),
    supabase.from("subscriptions").select("user_id, provider").in("user_id", ids).in("status", ["active", "trialing", "past_due"]),
  ]);
  const canValidate = new Map(((perms ?? []) as { id: string; can_validate_plans: boolean }[]).map((p) => [p.id, p.can_validate_plans]));
  const manual = new Set(((subs ?? []) as { user_id: string; provider: string }[]).filter((s) => s.provider === "manual").map((s) => s.user_id));
  const hasSub = new Set(((subs ?? []) as { user_id: string }[]).map((s) => s.user_id));

  return (
    <>
      <PageHeader title="Usuarios" subtitle={`${total} ${q.trim() ? "encontrados" : "registrados"}.`} />
      <form className="mb-4 flex gap-2" role="search">
        <label className="sr-only" htmlFor="q">Buscar por correo o nombre</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por correo o nombre" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base sm:text-sm" />
        <button className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">Buscar</button>
      </form>
      {error ? <Alert tone="danger">No se pudo cargar el listado.</Alert> : null}
      {!error && users.length === 0 ? <p className="text-sm text-muted">No hay usuarios que coincidan.</p> : null}
      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold">{u.email}</p>
                  <p className="text-sm text-muted">{u.display_name ?? "Sin nombre"} · alta {formatDate(u.created_at.slice(0, 10))}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {u.role === "admin" ? <Badge tone="lime">Administrador</Badge> : null}
                  <Badge tone={u.subscription_status === "activa" ? "success" : "neutral"}>
                    {u.plan}
                    {u.subscription_status ? ` · ${u.subscription_status}` : ""}
                  </Badge>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs text-muted">Distancia objetivo</dt><dd>{u.target_distance ? (DISTANCE_LABELS[u.target_distance as keyof typeof DISTANCE_LABELS] ?? u.target_distance) : "—"}</dd></div>
                <div><dt className="text-xs text-muted">Rol</dt><dd>{ROLE_LABELS[u.role]}</dd></div>
              </dl>
              {u.id !== user.id ? (
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary-ink">Acciones</summary>
                  <div className="mt-2 space-y-3">
                    {!hasSub.has(u.id) ? (
                      <form action={grantManualPremiumAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="days" value="30" /><button className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold">Otorgar 30 días de Premium</button></form>
                    ) : manual.has(u.id) ? (
                      <form action={revokeManualPremiumAction}><input type="hidden" name="userId" value={u.id} /><button className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold text-danger">Revocar Premium otorgado</button></form>
                    ) : null}
                    <RoleForm userId={u.id} role={u.role} canValidate={canValidate.get(u.id) ?? false} />
                  </div>
                </details>
              ) : (
                <p className="mt-3 text-xs text-muted">Tu cuenta: acceso total sin suscripción.</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-4 text-sm">
        {page > 1 ? <a className="min-h-11 py-2 font-semibold text-primary-ink" href={`?q=${encodeURIComponent(q)}&pagina=${page - 1}`}>← Anterior</a> : null}
        {total > page * SIZE ? <a className="min-h-11 py-2 font-semibold text-primary-ink" href={`?q=${encodeURIComponent(q)}&pagina=${page + 1}`}>Siguiente →</a> : null}
      </div>
    </>
  );
}
