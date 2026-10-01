"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert tone="danger" title="No pudimos cargar esta sección">Revisá tu conexión e intentá nuevamente.</Alert>
      <Button onClick={reset} variant="secondary">Reintentar</Button>
    </div>
  );
}
