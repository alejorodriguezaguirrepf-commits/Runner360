import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="on-dark sticky top-0 z-30 border-b border-white/10 bg-navy/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo dark />
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <a href="/#como-funciona" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white md:inline-block">
            Cómo funciona
          </a>
          <a href="/#planes" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white md:inline-block">
            Planes y precios
          </a>
          <a href="/calculadora" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:text-white md:inline-block">
            Calculadora
          </a>
          <ButtonLink href="/ingresar" variant="ghost" size="sm" className="text-white hover:bg-white/10">
            Ingresar
          </ButtonLink>
          <ButtonLink href="/registro" size="sm">
            Comenzar gratis
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
