"use client";
import { useActionState } from "react";
import { deleteAccountAction, reportIncidentAction } from "@/app/app/perfil/actions";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/form";

export function IncidentForm() {
  const [state, action] = useActionState(reportIncidentAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Tipo" htmlFor="kind">
        <Select id="kind" name="kind" defaultValue="bug">
          <option value="bug">Error de la aplicación</option>
          <option value="content">Contenido o plan</option>
          <option value="payment">Pagos</option>
          <option value="account">Cuenta</option>
          <option value="other">Otro</option>
        </Select>
      </Field>
      <Field label="Descripción" htmlFor="description" error={fe.description} hint="No incluyas contraseñas ni datos de tarjetas.">
        <Textarea id="description" name="description" maxLength={2000} required invalid={!!fe.description} />
      </Field>
      <SubmitButton variant="secondary" pendingText="Enviando…">Enviar reporte</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert> : null}
      <Field label="Motivo (opcional)" htmlFor="reason">
        <Input id="reason" name="reason" maxLength={500} />
      </Field>
      <Field label="Para confirmar, escribí ELIMINAR" htmlFor="confirm" error={fe.confirm}>
        <Input id="confirm" name="confirm" autoComplete="off" invalid={!!fe.confirm} />
      </Field>
      <SubmitButton variant="danger" pendingText="Eliminando…">Eliminar mi cuenta y mis datos</SubmitButton>
    </form>
  );
}
