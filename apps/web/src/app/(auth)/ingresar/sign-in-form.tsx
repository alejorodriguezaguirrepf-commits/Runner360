"use client";

import Link from "next/link";
import { FormMessage, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { signInAction } from "@/lib/actions/auth";

export interface SignInNotice {
  tone: "info" | "success" | "warning" | "danger";
  title?: string;
  text: string;
}

export function SignInForm({ next, notice }: { next: string; notice: SignInNotice | null }) {
  const { state, pending, onSubmit } = useFormAction(signInAction, initialActionState);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {notice ? (
        <Alert tone={notice.tone} title={notice.title}>
          {notice.text}
        </Alert>
      ) : null}
      <input type="hidden" name="next" value={next} />
      <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required error={state.errors?.email} />
      <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" required error={state.errors?.password} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full" pendingText="Ingresando…">Ingresar</SubmitButton>
      <div className="flex justify-between text-sm">
        <Link href="/recuperar" className="font-medium text-navy-700 underline-offset-4 hover:underline">Olvidé mi contraseña</Link>
        <Link href="/registro" className="font-medium text-navy-700 underline-offset-4 hover:underline">Crear cuenta</Link>
      </div>
    </form>
  );
}
