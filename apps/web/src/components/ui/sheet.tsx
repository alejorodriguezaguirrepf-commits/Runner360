"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Hoja modal accesible (dialog nativo): en el celular sube desde abajo a todo el ancho; en pantallas
 * grandes queda centrada. Escape o el botón Cerrar la cierran; el foco queda adentro mientras está abierta.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel = "Cerrar",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2">
              {closeLabel}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
