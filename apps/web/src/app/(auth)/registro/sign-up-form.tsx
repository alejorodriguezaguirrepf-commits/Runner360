"use client";

import { suggestEmail } from "@runner360/shared";
import Link from "next/link";
import { useState } from "react";
import { Turnstile } from "@/components/auth/turnstile";
import { CheckboxField, FormMessage, SubmitButton, TextField, useFormAction } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { signUpAction } from "@/lib/actions/auth";

/** Registro en un paso: al crear la cuenta la sesión queda iniciada y se pasa a las preguntas del plan. */
export function SignUpForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const { state, pending, onSubmit } = useFormAction(signUpAction, initialActionState);
  const [email, setEmail] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <TextField label="Nombre visible" name="displayName" autoComplete="given-name" required maxLength={60} error={state.errors?.displayName} />
      <div className="space-y-1.5">
        <TextField
          label="Correo electrónico"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (suggestion) setSuggestion(null);
          }}
          onBlur={() => setSuggestion(suggestEmail(email))}
          error={state.errors?.email}
        />
        {suggestion ? (
          <p className="text-sm text-ink" role="status">
            ¿Quisiste decir{" "}
            <button
              type="button"
              className="min-h-11 font-semibold text-primary-ink underline"
              onClick={() => {
                setEmail(suggestion);
                setSuggestion(null);
              }}
            >
              {suggestion}
            </button>
            ?
          </p>
        ) : null}
      </div>
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
      {turnstileSiteKey ? <Turnstile siteKey={turnstileSiteKey} resetKey={state} /> : null}
      {state.code === "email_exists" ? (
        <Alert tone="warning" title={state.message}>
          <Link href="/ingresar" className="font-semibold underline">Ingresá</Link> con tu contraseña o{" "}
          <Link href="/recuperar" className="font-semibold underline">recuperá tu contraseña</Link> si no la recordás.
        </Alert>
      ) : (
        <FormMessage state={state} />
      )}
      <SubmitButton pending={pending} className="w-full" pendingText="Creando cuenta…">Comenzar gratis</SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿Ya tenés cuenta? <Link href="/ingresar" className="font-semibold text-primary-ink hover:underline">Ingresá</Link>
      </p>
    </form>
  );
}
