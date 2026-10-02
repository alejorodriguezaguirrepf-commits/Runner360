import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-2xl font-extrabold">Creá tu cuenta gratis</h1>
      <p className="mt-1 text-sm text-muted">Después te hacemos unas preguntas para armar tu plan.</p>
      <div className="mt-6">
        <SignUpForm />
      </div>
    </>
  );
}
