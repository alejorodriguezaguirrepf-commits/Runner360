import Link from "next/link";
import { Logo } from "@/components/logo";

export function SiteFooter() {
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="on-dark bg-navy text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo dark />
          <p className="text-sm">Entrená. Medí. Progresá.</p>
          <p className="text-xs text-white/60">Producto en desarrollo · versión beta.</p>
        </div>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="font-semibold text-white">Legal</p>
          <Link className="block hover:text-lime" href="/privacidad">Política de privacidad (borrador)</Link>
          <Link className="block hover:text-lime" href="/terminos">Términos y condiciones (borrador)</Link>
        </nav>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-white">Contacto</p>
          {contact ? (
            <p>
              <a className="hover:text-lime" href={`mailto:${contact}`}>{contact}</a>
            </p>
          ) : (
            <p className="text-white/60">Canal de contacto pendiente de configuración.</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} RUNNER 360. La información de esta plataforma no reemplaza la consulta con profesionales de la salud.
      </div>
    </footer>
  );
}
