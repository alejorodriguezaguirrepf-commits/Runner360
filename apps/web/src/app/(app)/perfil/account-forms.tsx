"use client";

import { useActionState } from "react";
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { deleteAccountAction, reportIncidentAction, revokeHealthConsentAction } from "@/lib/actions/account";

export function RevokeHealthButton() {
  return (
    <form
      action={revokeHealthConsentAction}
      onSubmit={(e) => {
        if (!window.confirm("Se eliminarán los antecedentes de salud que registraste. ¿Continuar?")) e.preventDefault();
      }}
    >
      <button type="submit" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-danger hover:bg-danger-bg">Revocar</button>
    </form>
  );
}

export function IncidentForm() {
  const [state, action] = useActionState(reportIncidentAction, initialActionState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <SelectField
        label="Tipo"
        name="category"
        options={[
          { value: "bug", label: "Error de la aplicación" },
          { value: "content", label: "Contenido o plan" },
          { value: "billing", label: "Suscripción" },
          { value: "other", label: "Otro" },
        ]}
      />
      <TextAreaField label="Descripción" name="message" maxLength={2000} rows={3} error={state.errors?.message} hint="No incluyas datos de salud ni contraseñas." />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Enviando…">Enviar reporte</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialActionState);
  return (
    <form action={action} className="space-y-3" noValidate>
      <TextField label="Escribí ELIMINAR para confirmar" name="confirm" autoComplete="off" error={state.errors?.confirm} />
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingText="Eliminando…">Eliminar mi cuenta</SubmitButton>
    </form>
  );
}
