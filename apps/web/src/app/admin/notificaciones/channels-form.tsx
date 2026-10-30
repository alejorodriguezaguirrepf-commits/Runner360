"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/action-state";
import { updateAdminChannelsAction } from "@/lib/actions/notifications";

/** Activar o desactivar cada canal de aviso fuera de la app. */
export function ChannelsForm({ email, push, emailReady, pushReady, emailTo }: { email: boolean; push: boolean; emailReady: boolean; pushReady: boolean; emailTo: string }) {
  const [state, action, pending] = useActionState(updateAdminChannelsAction, initialActionState);
  return (
    <form action={action} className="space-y-3 text-sm">
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="email" defaultChecked={email} className="mt-1 size-5" />
        <span>
          <span className="font-semibold text-ink">Mail a {emailTo}</span>
          {!emailReady ? <span className="block text-muted">Pendiente de configuración: falta la clave de envío de mails.</span> : null}
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="push" defaultChecked={push} className="mt-1 size-5" />
        <span>
          <span className="font-semibold text-ink">Push en tus dispositivos</span>
          {!pushReady ? <span className="block text-muted">Pendiente de configuración: faltan las claves de push.</span> : null}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary">{pending ? "Guardando…" : "Guardar canales"}</button>
        {state.message ? <span role="status" className={state.ok ? "text-success" : "text-danger"}>{state.message}</span> : null}
      </div>
    </form>
  );
}
