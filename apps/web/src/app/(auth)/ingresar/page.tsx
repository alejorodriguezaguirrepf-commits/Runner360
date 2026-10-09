import type { Metadata } from "next";
import { SignInForm, type SignInNotice } from "./sign-in-form";

export const metadata: Metadata = { title: "Ingresar" };

const NOTICES: Record<string, SignInNotice> = {
  confirmado: {
    tone: "success",
    title: "Tu correo quedó confirmado",
    text: "Ya podés ingresar con tu correo y tu contraseña.",
  },
  enlace: { tone: "danger", text: "El enlace no es válido o ya se usó. Si lo necesitás, pedí uno nuevo." },
  vencido: { tone: "danger", text: "El enlace venció. Ingresá con tu correo y contraseña o pedí uno nuevo." },
  recuperacion: {
    tone: "warning",
    title: "No pudimos abrir el enlace",
    text: "Para cambiar la contraseña, abrí el enlace desde el mismo navegador donde lo pediste, o pedí uno nuevo desde “Olvidé mi contraseña”.",
  },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; confirmado?: string }> }) {
  const { next, error, confirmado } = await searchParams;
  const notice = confirmado ? NOTICES.confirmado! : error ? (NOTICES[error] ?? NOTICES.enlace!) : null;
  return (
    <>
      <h1 className="text-2xl font-extrabold">Ingresá a tu cuenta</h1>
      <p className="mt-1 text-sm text-muted">Seguí con tu plan donde lo dejaste.</p>
      <div className="mt-6">
        <SignInForm next={next ?? "/inicio"} notice={notice} />
      </div>
    </>
  );
}
