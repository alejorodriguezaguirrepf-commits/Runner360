import type { Metadata } from "next";
import { ConfigNotice } from "@/components/auth/config-notice";
import { UpdatePasswordForm } from "@/components/auth/forms";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function ResetPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-navy">Elegí una contraseña nueva</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Abriste esta página desde el enlace de recuperación que te enviamos.</p>
      <ConfigNotice />
      <UpdatePasswordForm disabled={!isSupabaseConfigured()} />
    </>
  );
}
