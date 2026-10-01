import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="contenido" className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold text-navy-600">Error 404</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">No encontramos esta página</h1>
        <p className="mt-2 text-muted">Puede que el enlace esté mal escrito o que el contenido ya no exista.</p>
        <ButtonLink href="/" className="mt-6">Ir al inicio</ButtonLink>
      </div>
    </main>
  );
}
