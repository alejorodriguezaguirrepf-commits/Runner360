"use client";

import { useActionState, useId } from "react";
import { initialActionState } from "@/lib/action-state";
import { deleteUserAction } from "@/lib/actions/admin";

/** Borrar una cuenta: se confirma escribiendo su correo. No se puede deshacer. */
export function DeleteUserForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(deleteUserAction, initialActionState);
  const id = useId();
  if (state.ok) return <p className="text-sm font-semibold text-success" role="status">{state.message}</p>;
  return (
    <details className="rounded-xl border border-danger/40 p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-danger">Eliminar usuario</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="userId" value={userId} />
        <p className="text-sm text-muted">
          Se borran la cuenta y todos sus datos: perfil, planes, entrenamientos, wellness y pulsaciones. Sus débitos quedan guardados sin datos
          personales. No se puede deshacer.
        </p>
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          Para confirmar, escribí el correo: <span className="font-normal break-all">{email}</span>
        </label>
        <input
          id={id}
          name="confirm"
          type="email"
          autoComplete="off"
          required
          aria-invalid={state.errors?.confirm ? true : undefined}
          aria-describedby={state.errors?.confirm ? `${id}-err` : undefined}
          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink sm:text-sm"
        />
        {state.errors?.confirm ? <p id={`${id}-err`} className="text-xs text-danger">{state.errors.confirm}</p> : null}
        <button disabled={pending} className="min-h-11 rounded-xl border border-danger/60 bg-danger-bg px-4 text-sm font-semibold text-danger hover:border-danger disabled:opacity-50">
          {pending ? "Borrando…" : "Borrar la cuenta"}
        </button>
        {state.message ? <p className="text-sm text-danger" role="alert">{state.message}</p> : null}
      </form>
    </details>
  );
}
