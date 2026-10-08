"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { changeRoleAction } from "@/lib/actions/admin";

export function RoleForm({ userId, role, canValidate }: { userId: string; role: string; canValidate: boolean }) {
  const [state, action, pending] = useActionState(changeRoleAction, initialActionState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Rol</label>
      <select id={`role-${userId}`} name="role" defaultValue={role} className="min-h-9 rounded-lg border border-line px-2 text-xs">
        <option value="user">Usuario</option>
        <option value="coach">Entrenador</option>
        <option value="admin">Administrador</option>
      </select>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="canValidatePlans" defaultChecked={canValidate} /> Valida planes</label>
      <button disabled={pending} className="min-h-9 rounded-lg bg-navy-900 px-2 text-xs font-semibold text-white">Guardar</button>
      {state.message ? <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`} role="status">{state.message}</span> : null}
    </form>
  );
}
