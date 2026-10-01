"use client";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold text-navy">Algo salió mal</h1>
        <p className="mt-2 text-muted">Ocurrió un error inesperado. Si persiste, reportalo desde tu perfil.</p>
        <Button onClick={reset} className="mt-6">Reintentar</Button>
      </div>
    </main>
  );
}
