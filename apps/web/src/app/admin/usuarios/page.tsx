import { formatDate, ROLE_LABELS, type ProfileRow } from "@runner360/shared";
import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { grantManualPremiumAction, revokeManualPremiumAction } from "@/lib/actions/admin";
import { RoleForm } from "./role-form";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; rol?: string; pagina?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { q = "", rol = "", pagina = "1" } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const size = 25;
  let query = supabase
    .from("profiles")
    .select("id, display_name, role, can_validate_plans, onboarding_completed_at, deletion_requested_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (q.trim()) query = query.ilike("display_name", `%${q.trim().replace(/[%_]/g, "")}%`);
  if (rol === "user" || rol === "coach" || rol === "admin") query = query.eq("role", rol);
  const { data, count } = await query;
  const users = (data ?? []) as (ProfileRow & { deletion_requested_at: string | null })[];
  const { data: subs } = await supabase.from("subscriptions").select("user_id, status, provider, current_period_end").in("user_id", users.map((u) => u.id)).in("status", ["active", "trialing", "past_due"]);
  const subByUser = new Map(((subs ?? []) as { user_id: string; status: string; provider: string; current_period_end: string | null }[]).map((s) => [s.user_id, s]));

  return (
    <>
      <PageHeader title="Usuarios" subtitle={`${count ?? 0} en total. Los correos solo son visibles en Supabase Auth (minimización de datos).`} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">Buscar por nombre</label>
        <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm" />
        <label className="sr-only" htmlFor="rol">Rol</label>
        <select id="rol" name="rol" defaultValue={rol} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm">
          <option value="">Todos los roles</option>
          <option value="user">Usuarios</option>
          <option value="coach">Entrenadores</option>
          <option value="admin">Administradores</option>
        </select>
        <button className="min-h-11 rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      <Card flush className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-muted"><tr><th className="p-3">Usuario</th><th className="p-3">Alta</th><th className="p-3">Suscripción</th><th className="p-3">Rol y permisos</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const sub = subByUser.get(u.id);
              return (
                <tr key={u.id} className="align-top">
                  <td className="p-3">
                    <p className="font-semibold">{u.display_name ?? "Sin nombre"}</p>
                    <p className="font-mono text-[11px] text-muted">{u.id}</p>
                    {!u.onboarding_completed_at ? <Badge tone="warning">Sin onboarding</Badge> : null}
                    {u.deletion_requested_at ? <Badge tone="danger">Pidió eliminar cuenta</Badge> : null}
                  </td>
                  <td className="p-3">{formatDate(u.created_at.slice(0, 10))}</td>
                  <td className="p-3">
                    {sub ? <Badge tone="lime">Premium · {sub.provider}</Badge> : <Badge>Free</Badge>}
                    <div className="mt-2 flex gap-1">
                      {!sub ? (
                        <form action={grantManualPremiumAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="days" value="30" /><button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold">Otorgar 30 días</button></form>
                      ) : sub.provider === "manual" ? (
                        <form action={revokeManualPremiumAction}><input type="hidden" name="userId" value={u.id} /><button className="min-h-9 rounded-lg border border-line px-2 text-xs font-semibold text-danger">Revocar</button></form>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3">
                    <p className="mb-1 text-xs text-muted">{ROLE_LABELS[u.role]}{u.can_validate_plans ? " · valida planes" : ""}</p>
                    {u.id !== user.id ? <RoleForm userId={u.id} role={u.role} canValidate={u.can_validate_plans} /> : <span className="text-xs text-muted">(vos)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 flex gap-2 text-sm">
        {page > 1 ? <a className="font-semibold text-navy-700" href={`?q=${encodeURIComponent(q)}&rol=${rol}&pagina=${page - 1}`}>← Anterior</a> : null}
        {(count ?? 0) > page * size ? <a className="font-semibold text-navy-700" href={`?q=${encodeURIComponent(q)}&rol=${rol}&pagina=${page + 1}`}>Siguiente →</a> : null}
      </div>
    </>
  );
}
