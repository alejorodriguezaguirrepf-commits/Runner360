"use client";

import { Button } from "@/components/ui/primitives";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">Algo salió mal</h1>
      <p className="max-w-md text-muted">No pudimos cargar esta sección. Si el problema persiste, reportalo desde tu perfil.</p>
      <Button onClick={() => reset()}>Reintentar</Button>
    </main>
  );
}
