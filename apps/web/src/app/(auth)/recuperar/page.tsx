"use client";

import { FormMessage, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export default function RecoverPage() {
  const { state, pending, onSubmit } = useFormAction(requestPasswordResetAction, initialActionState);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Recuperá tu contraseña</h1>
      <p className="mt-1 text-sm text-muted">Te enviamos un enlace para crear una nueva.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
        <FormMessage state={state} />
        <SubmitButton pending={pending} className="w-full" pendingText="Enviando…">Enviar enlace</SubmitButton>
      </form>
    </>
  );
}
