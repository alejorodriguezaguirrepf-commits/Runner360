"use client";

import { useRef } from "react";
import { setMotivationalEmailsAction } from "@/lib/actions/email-preferences";

/** Correos de motivación: se guarda al tocar el interruptor. */
export function EmailPrefToggle({ on }: { on: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setMotivationalEmailsAction}>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-semibold">Recibir correos de motivación</span>
        <input
          type="checkbox"
          name="motivational"
          defaultChecked={on}
          onChange={() => form.current?.requestSubmit()}
          className="size-6 shrink-0 accent-[var(--color-primary)]"
        />
      </label>
    </form>
  );
}
