import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Ingresá a tu cuenta</h1>
      <p className="mt-1 text-sm text-muted">Seguí con tu plan donde lo dejaste.</p>
      <div className="mt-6">
        <SignInForm next={next ?? "/inicio"} linkError={error === "enlace"} />
      </div>
    </>
  );
}
