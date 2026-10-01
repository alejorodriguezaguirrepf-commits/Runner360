"use client";
import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, v, type ActionState } from "@/lib/form";

function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action] = useActionState(signInAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Correo electrónico" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" defaultValue={v(state.values, "email")} autoComplete="email" required invalid={!!fe.email} disabled={disabled} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fe.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required invalid={!!fe.password} disabled={disabled} />
      </Field>
      <div className="text-right text-sm">
        <Link href="/recuperar" className="font-medium text-navy-600 underline">
          Olvidé mi contraseña
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Ingresando…" disabled={disabled}>
        Ingresar
      </SubmitButton>
    </form>
  );
}

export function SignUpForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(signUpAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Nombre visible" htmlFor="displayName" error={fe.displayName}>
        <Input id="displayName" name="displayName" defaultValue={v(state.values, "displayName")} autoComplete="nickname" required invalid={!!fe.displayName} disabled={disabled} />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" defaultValue={v(state.values, "email")} autoComplete="email" required invalid={!!fe.email} disabled={disabled} />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres, con letras y números." error={fe.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required invalid={!!fe.password} disabled={disabled} />
      </Field>
      <Field label="Repetí la contraseña" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required invalid={!!fe.confirm} disabled={disabled} />
      </Field>
      <div>
        <Checkbox
          id="accept"
          name="accept"
          disabled={disabled}
          label={
            <>
              Leí y acepto los <Link className="underline" href="/terminos" target="_blank">términos</Link> y la{" "}
              <Link className="underline" href="/privacidad" target="_blank">política de privacidad</Link> (borradores beta).
            </>
          }
        />
        {fe.accept ? <p className="mt-1 text-xs font-medium text-danger">{fe.accept}</p> : null}
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Creando cuenta…" disabled={disabled}>
        Crear cuenta gratis
      </SubmitButton>
    </form>
  );
}

export function ResetRequestForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(requestPasswordResetAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Correo electrónico" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" defaultValue={v(state.values, "email")} autoComplete="email" required invalid={!!fe.email} disabled={disabled} />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Enviando…" disabled={disabled}>
        Enviar enlace
      </SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(updatePasswordAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Nueva contraseña" htmlFor="password" hint="Mínimo 8 caracteres, con letras y números." error={fe.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required invalid={!!fe.password} disabled={disabled} />
      </Field>
      <Field label="Repetí la contraseña" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required invalid={!!fe.confirm} disabled={disabled} />
      </Field>
      <SubmitButton className="w-full" size="lg" disabled={disabled}>
        Guardar contraseña
      </SubmitButton>
    </form>
  );
}
