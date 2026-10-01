import type { Metadata } from "next";
import Link from "next/link";
import { ConfigNotice } from "@/components/auth/config-notice";
import { ResetRequestForm } from "@/components/auth/forms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Recuperar contraseña</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Te enviaremos un enlace para crear una contraseña nueva.</p>
      <ConfigNotice />
      <ResetRequestForm disabled={!isSupabaseConfigured()} />
      <p className="mt-6 text-sm">
        <Link href="/ingresar" className="font-medium text-navy-600 underline">Volver a ingresar</Link>
      </p>
    </>
  );
}
