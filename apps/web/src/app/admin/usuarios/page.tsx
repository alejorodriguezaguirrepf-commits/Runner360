import type { Metadata } from "next";
import { formatDate } from "@runner360/shared";
import { PageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelManualSubscriptionAction, grantSubscriptionAction, setRoleAction } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

type U = {
  id: string; email: string; display_name: string | null; created_at: string; onboarding_completed_at: string | null;
  user_roles: { role: string }[];
};
type S = { id: string; user_id: string; status: string; provider: string; current_period_end: string | null };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const q = (sp.q ?? "").trim().slice(0, 80);
  const role = ["user", "coach", "admin"].includes(sp.rol ?? "") ? sp.rol! : "";
  let query = supabase
    .from("profiles")
    .select(`id, email, display_name, created_at, onboarding_completed_at, user_roles${role ? "!inner" : ""}(role)`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    // Valores entre comillas dobles: PostgREST interpreta "." y "," como separadores dentro de or().
    const safe = q.replace(/["\\%,()*]/g, " ");
    query = query.or(`email.ilike."%${safe}%",display_name.ilike."%${safe}%"`);
  }
  if (role) query = query.eq("user_roles.role", role);
  const { data } = await query;
  const users = (data ?? []) as unknown as U[];
  const { data: subs } = users.length
    ? await supabase.from("subscriptions").select("id, user_id, status, provider, current_period_end").in("user_id", users.map((u) => u.id)).in("status", ["active", "trialing", "past_due"])
    : { data: [] };
  const subsByUser = new Map<string, S[]>();
  for (const s of (subs ?? []) as S[]) subsByUser.set(s.user_id, [...(subsByUser.get(s.user_id) ?? []), s]);

  return (
    <>
      <PageHeader title="Usuarios" description="Búsqueda, roles y suscripciones. Los datos de salud y entrenamientos individuales no son accesibles desde aquí." />
      {sp.error ? <Alert tone="danger" className="mb-4">No se pudo completar la acción ({sp.error}).</Alert> : null}
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label htmlFor="q" className="sr-only">Buscar por correo o nombre</label>
        <Input id="q" name="q" defaultValue={q} placeholder="Buscar por correo o nombre" className="max-w-xs" />
        <label htmlFor="rol" className="sr-only">Rol</label>
        <Select id="rol" name="rol" defaultValue={role} className="max-w-[12rem]">
          <option value="">Todos los roles</option><option value="user">Usuario</option><option value="coach">Entrenador</option><option value="admin">Administrador</option>
        </Select>
        <Button type="submit" variant="dark">Filtrar</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase text-muted">
            <tr><th scope="col" className="p-3">Usuario</th><th scope="col">Alta</th><th scope="col">Roles</th><th scope="col">Suscripción</th><th scope="col">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => {
              const roles = u.user_roles.map((r) => r.role);
              const active = subsByUser.get(u.id) ?? [];
              return (
                <tr key={u.id} className="align-top">
                  <td className="p-3"><p className="font-medium">{u.display_name ?? "—"}</p><p className="text-xs text-muted">{u.email}</p></td>
                  <td className="py-3">{formatDate(u.created_at)}<p className="text-xs text-muted">{u.onboarding_completed_at ? "Perfil completo" : "Sin perfil"}</p></td>
                  <td className="py-3"><div className="flex flex-wrap gap-1">{roles.map((r) => <Badge key={r} tone={r === "admin" ? "navy" : "neutral"}>{r}</Badge>)}</div></td>
                  <td className="py-3">
                    {active.length === 0 ? <span className="text-muted">Free</span> : active.map((s) => (
                      <div key={s.id} className="mb-1">
                        <Badge tone="success">{s.status}</Badge> <span className="text-xs text-muted">{s.provider}{s.current_period_end ? ` · hasta ${formatDate(s.current_period_end)}` : ""}</span>
                        {s.provider === "manual" ? (
                          <form action={cancelManualSubscriptionAction} className="inline"><input type="hidden" name="subscriptionId" value={s.id} /><SubmitButton size="sm" variant="ghost" pendingText="…">Cancelar</SubmitButton></form>
                        ) : null}
                      </div>
                    ))}
                  </td>
                  <td className="space-y-2 py-3 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {(["coach", "admin"] as const).map((r) => {
                        const has = roles.includes(r);
                        if (r === "admin" && has && u.id === viewer.id) return null;
                        return (
                          <form key={r} action={setRoleAction}>
                            <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={r} /><input type="hidden" name="grant" value={has ? "false" : "true"} />
                            <SubmitButton size="sm" variant="secondary" pendingText="…">{has ? `Quitar ${r === "coach" ? "entrenador" : "admin"}` : `Hacer ${r === "coach" ? "entrenador" : "admin"}`}</SubmitButton>
                          </form>
                        );
                      })}
                    </div>
                    <form action={grantSubscriptionAction} className="flex items-center gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <label htmlFor={`days-${u.id}`} className="sr-only">Días de Premium</label>
                      <Input id={`days-${u.id}`} name="days" type="number" min={1} max={730} defaultValue={30} className="w-20 py-1.5" />
                      <SubmitButton size="sm" pendingText="…">Dar Premium (días)</SubmitButton>
                    </form>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-muted">Sin resultados.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
