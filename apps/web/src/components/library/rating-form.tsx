"use client";

import { useState } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/ui/form";
import { cx } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { rateSessionAction } from "@/lib/actions/ratings";

const R = t.library.rating;
const VALUES = [1, 2, 3, 4, 5] as const;

/** "¿Cómo te fue?": cinco opciones (carita + texto) y una nota opcional. */
export function RatingForm({ date, rating, note }: { date: string; rating: number | null; note: string | null }) {
  const { state, pending, onSubmit } = useFormAction(rateSessionAction, { ok: false });
  const [value, setValue] = useState<number | null>(rating);
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-xl border border-line bg-surface-2 p-3">
      <input type="hidden" name="date" value={date} />
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">{R.question}</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {VALUES.map((v) => (
            <label
              key={v}
              className={cx(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-ink",
                value === v ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-primary",
              )}
            >
              <input type="radio" name="rating" value={v} checked={value === v} onChange={() => setValue(v)} className="sr-only" />
              <span aria-hidden="true" className="text-xl leading-none">{R.emoji[v]}</span>
              <span className="text-xs font-semibold leading-tight">{R.options[v]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">{R.note}</span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={500}
          rows={2}
          placeholder={R.notePlaceholder}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted/70"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingText={R.saving}>{rating ? R.update : R.save}</SubmitButton>
    </form>
  );
}
