"use client";

import type { ContentRow } from "@runner360/shared";
import { useActionState } from "react";
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { initialActionState } from "@/lib/action-state";
import { saveContentAction } from "@/lib/actions/admin";

export function ContentForm({ content }: { content: ContentRow | null }) {
  const [state, action] = useActionState(saveContentAction, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      {content ? <input type="hidden" name="id" value={content.id} /> : null}
      <TextField label="Título" name="title" defaultValue={content?.title} error={e.title} />
      <TextField label="Identificador (slug)" name="slug" defaultValue={content?.slug} error={e.slug} />
      <SelectField label="Categoría" name="category" defaultValue={content?.category ?? "general"} options={[{ value: "hydration", label: "Hidratación" }, { value: "training", label: "Entrenamiento" }, { value: "injury_prevention", label: "Prevención" }, { value: "nutrition", label: "Nutrición" }, { value: "general", label: "General" }]} />
      <div className="self-end"><CheckboxField name="isPremium" label="Solo Premium" defaultChecked={content?.is_premium} /></div>
      <div className="sm:col-span-2"><TextField label="Resumen" name="summary" defaultValue={content?.summary} /></div>
      <div className="sm:col-span-2"><TextAreaField label="Cuerpo (Markdown básico: párrafos, listas con -, **negrita**)" name="body" rows={8} defaultValue={content?.body} error={e.body} /></div>
      <div className="sm:col-span-2"><FormMessage state={state} /><SubmitButton variant="secondary">Guardar</SubmitButton></div>
    </form>
  );
}
