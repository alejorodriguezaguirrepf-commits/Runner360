"use client";

import { startTransition, useActionState, useId, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { Alert, Button, cx } from "./primitives";

const INPUT =
  "block w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/20 aria-[invalid=true]:border-danger min-h-11";

interface FieldBase {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
}

function FieldWrap({ id, label, hint, error, children }: { id: string; label: string; hint?: ReactNode; error?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, name, hint, error, className, ...props }: FieldBase & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cx(INPUT, className)}
        {...props}
      />
    </FieldWrap>
  );
}

export function SelectField({
  label,
  name,
  hint,
  error,
  options,
  placeholder,
  ...props
}: FieldBase & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error}>
      <select id={id} name={name} aria-invalid={error ? true : undefined} className={INPUT} {...props}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldWrap>
  );
}

export function TextAreaField({ label, name, hint, error, ...props }: FieldBase & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error}>
      <textarea id={id} name={name} aria-invalid={error ? true : undefined} className={cx(INPUT, "min-h-24")} {...props} />
    </FieldWrap>
  );
}

export function CheckboxField({ label, name, error, hint, ...props }: Omit<FieldBase, "label"> & { label: ReactNode } & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" name={name} className="mt-0.5 size-5 shrink-0 accent-navy-900" aria-invalid={error ? true : undefined} {...props} />
        <label htmlFor={id} className="text-sm text-ink">
          {label}
          {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
        </label>
      </div>
      {error ? <p className="pl-8 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}

/** Grupo de opciones (checkbox o radio) como "chips" accesibles. */
export function ChoiceGroup({
  legend,
  name,
  type,
  options,
  defaultValues = [],
  error,
  hint,
}: {
  legend: string;
  name: string;
  type: "checkbox" | "radio";
  options: { value: string; label: string }[];
  defaultValues?: string[];
  error?: string;
  hint?: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-navy-700"
          >
            <input type={type} name={name} value={o.value} defaultChecked={defaultValues.includes(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </fieldset>
  );
}

/**
 * Envía un formulario a una Server Action SIN que React lo vacíe al terminar.
 * Con `<form action={…}>` React reinicia los campos después de cada envío, y ante un error de
 * validación el usuario perdía lo que había escrito (p. ej. el correo al equivocarse de clave).
 */
export function useFormAction(action: (prev: ActionState, formData: FormData) => Promise<ActionState>, initial: ActionState) {
  const [state, dispatch, pending] = useActionState(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };
  return { state, pending, onSubmit };
}

export function SubmitButton({
  children,
  pendingText = "Guardando…",
  variant = "primary",
  className,
  pending: pendingProp,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  /** Estado de envío cuando el formulario usa `useFormAction`. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}
