"use client";

import Link from "next/link";
import { CheckboxField, FormMessage, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { signUpAction } from "@/lib/actions/auth";

export function SignUpForm() {
  const { state, pending, onSubmit } = useFormAction(signUpAction, initialActionState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <TextField label="Nombre visible" name="displayName" autoComplete="given-name" required maxLength={60} error={state.errors?.displayName} />
      <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Mínimo 10 caracteres, con letras y números."
        error={state.errors?.password}
      />
      <CheckboxField
        name="acceptTerms"
        label={
          <>
            Acepto los <Link href="/terminos" target="_blank" className="font-semibold underline">términos</Link> y la{" "}
            <Link href="/privacidad" target="_blank" className="font-semibold underline">política de privacidad</Link> (borradores de la beta).
          </>
        }
        error={state.errors?.acceptTerms}
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Creando cuenta…">Comenzar gratis</SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta? <Link href="/ingresar" className="font-semibold text-navy-700 hover:underline">Ingresá</Link>
      </p>
    </form>
  );
}
