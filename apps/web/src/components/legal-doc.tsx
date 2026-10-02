import type { ReactNode } from "react";
import { Alert } from "@/components/ui/primitives";

export function LegalDoc({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Versión {version}</p>
      <div className="mt-6">
        <Alert tone="warning" title="Borrador sujeto a revisión legal">
          Este documento es un borrador inicial preparado durante el desarrollo de la beta. No fue revisado ni aprobado por asesoría legal y puede cambiar antes del lanzamiento.
        </Alert>
      </div>
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </article>
  );
}
