import type { Metadata } from "next";
import Link from "next/link";
import { ConfigNotice } from "@/components/auth/config-notice";
import { SignUpForm } from "@/components/auth/forms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Creá tu cuenta</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        ¿Ya tenés cuenta? <Link href="/ingresar" className="font-semibold text-navy-600 underline">Ingresá</Link>
      </p>
      <ConfigNotice />
      <SignUpForm disabled={!isSupabaseConfigured()} />
    </>
  );
}
