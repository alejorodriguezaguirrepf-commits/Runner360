"use client";

import { useActionState, useState } from "react";
import { initialActionState } from "@/lib/action-state";
import { changeRoleAction } from "@/lib/actions/admin";

/**
 * Rol de una persona. «Firma la validación profesional de planes» es un permiso solo para
 * entrenadores (firmar las versiones de los planes de la biblioteca antes de publicarlas): no tiene
 * nada que ver con el acceso de cada persona a su plan, que se libera solo con cada pago aprobado.
 */
export function RoleForm({ userId, role, canValidate }: { userId: string; role: string; canValidate: boolean }) {
  const [state, action, pending] = useActionState(changeRoleAction, initialActionState);
  const [selected, setSelected] = useState(role);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>Rol</label>
      <select
        id={`role-${userId}`}
        name="role"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="min-h-9 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
      >
        <option value="user">Usuario</option>
        <option value="coach">Entrenador</option>
      </select>
      {selected === "coach" ? (
        <label className="flex items-center gap-1 text-xs" title="Permiso del equipo: firmar la validación profesional de las versiones de los planes antes de publicarlas.">
          <input type="checkbox" name="canValidatePlans" defaultChecked={canValidate} /> Firma la validación profesional de planes
        </label>
      ) : null}
      <button disabled={pending} className="min-h-9 rounded-lg bg-primary px-2 text-xs font-semibold text-on-primary">Guardar</button>
      {state.message ? <span className={`text-xs ${state.ok ? "text-success" : "text-danger"}`} role="status">{state.message}</span> : null}
    </form>
  );
}
