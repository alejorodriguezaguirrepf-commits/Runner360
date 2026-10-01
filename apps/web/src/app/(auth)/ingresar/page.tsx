import type { Metadata } from "next";
import Link from "next/link";
import { ConfigNotice } from "@/components/auth/config-notice";
import { SignInForm } from "@/components/auth/forms";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Ingresar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Ingresá a tu cuenta</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        ¿No tenés cuenta? <Link href="/registro" className="font-semibold text-navy-600 underline">Registrate gratis</Link>
      </p>
      <ConfigNotice />
      {sp.motivo === "enlace-invalido" ? (
        <Alert tone="danger" className="mb-4">El enlace es inválido o expiró. Volvé a solicitarlo.</Alert>
      ) : null}
      {sp.next && isSupabaseConfigured() ? (
        <Alert className="mb-4">Ingresá para continuar.</Alert>
      ) : null}
      <SignInForm next={safeNext(sp.next)} disabled={!isSupabaseConfigured()} />
    </>
  );
}
