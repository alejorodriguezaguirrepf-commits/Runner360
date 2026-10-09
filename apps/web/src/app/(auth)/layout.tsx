import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { Alert } from "@/components/ui/primitives";
import { connection } from "next/server";
import { AUTH_UNAVAILABLE_MESSAGE, isSupabaseConfigured } from "@/lib/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // La configuración se evalúa en cada solicitud: nunca queda fijada en el build.
  await connection();
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10">
      <Link href="/" aria-label="Volver al inicio" className="mb-8">
        <Logo />
      </Link>
      <main id="contenido" className="w-full max-w-md space-y-4">
        {!isSupabaseConfigured() ? (
          <Alert tone="warning" title="Servicio no disponible por el momento">
            {AUTH_UNAVAILABLE_MESSAGE}
          </Alert>
        ) : null}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
