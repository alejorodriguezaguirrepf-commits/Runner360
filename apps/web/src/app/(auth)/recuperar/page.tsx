"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export default function RecoverPage() {
  const [state, action] = useActionState(requestPasswordResetAction, initialActionState);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Recuperá tu contraseña</h1>
      <p className="mt-1 text-sm text-muted">Te enviamos un enlace para crear una nueva.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
        <FormMessage state={state} />
        <SubmitButton className="w-full" pendingText="Enviando…">Enviar enlace</SubmitButton>
      </form>
    </>
  );
}
