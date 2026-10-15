import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/primitives";
import { publicEnv } from "@/lib/env";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-nav/95 backdrop-blur">
        <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="RUNNER 360, inicio">
            <Logo inverted />
          </Link>
          <div className="hidden items-center gap-6 text-sm font-medium text-nav-muted md:flex">
            <a href="#como-funciona" className="hover:text-nav-ink">Cómo funciona</a>
            <a href="#distancias" className="hover:text-nav-ink">Distancias</a>
            <a href="#precios" className="hover:text-nav-ink">Planes y precios</a>
            <a href="#preguntas" className="hover:text-nav-ink">Preguntas</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ingresar" className="rounded-lg px-3 py-2 text-sm font-semibold text-nav-ink hover:bg-white/10">
              Ingresar
            </Link>
            <span className="hidden sm:block">
              <ButtonLink href="/registro">Comenzar gratis</ButtonLink>
            </span>
          </div>
        </nav>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <footer className="nav-zone bg-nav text-nav-muted">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div className="space-y-3">
            <Logo inverted />
            <p className="text-sm">Entrená. Medí. Progresá.</p>
            <p className="text-xs text-nav-muted">Producto en desarrollo · versión beta.</p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-nav-ink">Legal</p>
            <ul className="space-y-1.5">
              <li><Link href="/privacidad" className="hover:text-nav-ink">Política de privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-nav-ink">Términos y condiciones</Link></li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-nav-ink">Contacto</p>
            {publicEnv.supportEmail ? (
              <a href={`mailto:${publicEnv.supportEmail}`} className="hover:text-nav-ink">{publicEnv.supportEmail}</a>
            ) : (
              <p className="text-nav-muted">Canal de contacto en configuración.</p>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-nav-muted">
          © {new Date().getFullYear()} RUNNER 360. La información de la plataforma no reemplaza la consulta con profesionales de la salud.
        </div>
      </footer>
    </div>
  );
}
