import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { Alert } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-canvas px-4 py-10">
      <Link href="/" aria-label="Volver al inicio" className="mb-8">
        <Logo />
      </Link>
      <main id="contenido" className="w-full max-w-md space-y-4">
        {!isSupabaseConfigured() ? (
          <Alert tone="warning" title="Autenticación pendiente de configuración">
            Esta instalación todavía no tiene credenciales de Supabase. Completá las variables de entorno indicadas en el README para habilitar el registro y el ingreso.
          </Alert>
        ) : null}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  );
}
