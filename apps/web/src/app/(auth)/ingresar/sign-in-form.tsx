"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton, TextField } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { signInAction } from "@/lib/actions/auth";

export function SignInForm({ next, linkError }: { next: string; linkError: boolean }) {
  const [state, action] = useActionState(signInAction, initialActionState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {linkError ? <Alert tone="danger">El enlace no es válido o venció. Pedí uno nuevo.</Alert> : null}
      <input type="hidden" name="next" value={next} />
      <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Ingresando…">Ingresar</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/recuperar" className="font-medium text-navy-700 underline-offset-4 hover:underline">Olvidé mi contraseña</Link>
        <Link href="/registro" className="font-medium text-navy-700 underline-offset-4 hover:underline">Crear cuenta</Link>
      </div>
    </form>
  );
}
