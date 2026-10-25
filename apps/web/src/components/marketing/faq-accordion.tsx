"use client";

import { useId, useState, type ReactNode } from "react";
import type { FaqItem } from "@/i18n/es-AR/faq";
import { cx } from "@/components/ui/primitives";

/**
 * Acordeón accesible (patrón WAI-ARIA): cada pregunta es un botón con aria-expanded y
 * aria-controls; la respuesta es una región rotulada por su pregunta. Enter y Espacio abren y
 * cierran (botones nativos); ↑ ↓ Inicio y Fin mueven el foco entre preguntas.
 * `answers` reemplaza el texto de una respuesta por contenido propio (por ejemplo, con foto);
 * `defaultOpen` deja abiertas esas preguntas al cargar.
 */
export function FaqAccordion({
  items,
  answers = {},
  defaultOpen = [],
}: {
  items: readonly FaqItem[];
  answers?: Partial<Record<string, ReactNode>>;
  defaultOpen?: readonly string[];
}) {
  const base = useId();
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const buttons = Array.from(e.currentTarget.closest("[data-faq]")?.querySelectorAll<HTMLButtonElement>("button[data-faq-q]") ?? []);
    const target =
      e.key === "ArrowDown" ? buttons[(index + 1) % buttons.length]
      : e.key === "ArrowUp" ? buttons[(index - 1 + buttons.length) % buttons.length]
      : e.key === "Home" ? buttons[0]
      : e.key === "End" ? buttons[buttons.length - 1]
      : undefined;
    if (target) {
      e.preventDefault();
      target.focus();
    }
  }

  return (
    <div data-faq className="divide-y divide-line rounded-2xl border border-line">
      {items.map((item, i) => {
        const expanded = open.has(item.id);
        const qId = `${base}-${item.id}-q`;
        const aId = `${base}-${item.id}-a`;
        return (
          <div key={item.id} data-faq-id={item.id}>
            <h3 className="text-base">
              <button
                type="button"
                id={qId}
                data-faq-q
                aria-expanded={expanded}
                aria-controls={aId}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="flex min-h-11 w-full items-center justify-between gap-4 rounded-2xl p-5 text-left font-semibold focus-visible:outline-offset-[-3px]"
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className={cx("text-xl leading-none text-muted transition", expanded && "rotate-45")}>+</span>
              </button>
            </h3>
            <div id={aId} role="region" aria-labelledby={qId} hidden={!expanded} className="px-5 pb-5">
              {answers[item.id] ?? <p data-faq-answer className="text-sm text-muted">{item.answer}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
