import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="on-dark hidden flex-col justify-between bg-navy p-10 text-white lg:flex">
        <Logo dark />
        <div>
          <p className="text-4xl font-extrabold leading-tight">Entrená. Medí. Progresá.</p>
          <p className="mt-4 max-w-md text-white/75">
            Planes por distancia y nivel, calendario, registro de entrenamientos y evolución en un solo lugar.
          </p>
        </div>
        <p className="text-xs text-white/50">Versión beta · producto en desarrollo</p>
      </aside>
      <main id="contenido" className="flex flex-col px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-center text-xs text-muted">
          <Link className="underline" href="/privacidad">Privacidad</Link> ·{" "}
          <Link className="underline" href="/terminos">Términos</Link>
        </p>
      </main>
    </div>
  );
}
