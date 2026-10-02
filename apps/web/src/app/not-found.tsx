import { ButtonLink } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main id="contenido" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">No encontramos esta página</h1>
      <p className="text-muted">Puede que el enlace haya cambiado o que no tengas acceso.</p>
      <ButtonLink href="/">Ir al inicio</ButtonLink>
    </main>
  );
}
