import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

export function LegalLayout({ title, version, children }: { title: string; version: string; children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-navy">{title}</h1>
        <p className="mt-2 text-sm text-muted">Versión: {version}</p>
        <Alert tone="warning" className="mt-6" title="Borrador sujeto a revisión legal">
          Este documento es un borrador inicial y no fue aprobado legalmente. Antes del lanzamiento debe ser revisado por un
          profesional del derecho considerando la Ley 25.326 de Protección de los Datos Personales (Argentina) y la normativa
          aplicable en otros países donde se ofrezca el servicio.
        </Alert>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
