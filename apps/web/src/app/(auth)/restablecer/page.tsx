"use client";

import Link from "next/link";
import { FormMessage, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { updatePasswordAction } from "@/lib/actions/auth";

export default function ResetPasswordPage() {
  const { state, pending, onSubmit } = useFormAction(updatePasswordAction, initialActionState);
  return (
    <>
      <h1 className="text-2xl font-extrabold">Nueva contraseña</h1>
      {state.ok ? (
        <div className="mt-6 space-y-4">
          <FormMessage state={state} />
          <Link href="/inicio" className="font-semibold text-navy-700 hover:underline">Ir al inicio</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <TextField label="Contraseña nueva" name="password" type="password" autoComplete="new-password" hint="Mínimo 10 caracteres, con letras y números." error={state.errors?.password} />
          <TextField label="Repetí la contraseña" name="confirm" type="password" autoComplete="new-password" error={state.errors?.confirm} />
          <FormMessage state={state} />
          <SubmitButton pending={pending} className="w-full">Guardar contraseña</SubmitButton>
        </form>
      )}
    </>
  );
}
