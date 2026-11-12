import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui/primitives";
import { unsubscribeByToken } from "@/lib/actions/email-preferences";

export const metadata: Metadata = { title: "Correos de RUNNER 360", robots: { index: false, follow: false } };

async function unsubscribe(formData: FormData) {
  "use server";
  const ok = await unsubscribeByToken(String(formData.get("t") ?? ""));
  redirect(ok ? "/correos/baja?listo=1" : "/correos/baja?error=1");
}

/** Baja de los correos de motivación desde el link del correo (sin iniciar sesión), con confirmación. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; listo?: string; error?: string }> }) {
  const { t = "", listo, error } = await searchParams;
  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <Card>
        {listo ? (
          <>
            <h1 className="text-2xl font-extrabold">Listo, no te vamos a mandar más estos correos</h1>
            <p className="mt-2 text-muted">Si cambiás de idea, podés volver a activarlos desde tu perfil en la app. ¡Que sigas disfrutando cada kilómetro!</p>
            <Link href="/inicio" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary-ink underline">Ir a la app</Link>
          </>
        ) : error || !t ? (
          <>
            <h1 className="text-2xl font-extrabold">No pudimos encontrar tu suscripción a los correos</h1>
            <p className="mt-2 text-muted">El link puede estar incompleto. Podés desactivar los correos desde tu perfil en la app.</p>
            <Link href="/perfil" className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary-ink underline">Ir a mi perfil</Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">¿Dejar de recibir los correos de motivación?</h1>
            <p className="mt-2 text-muted">
              Son los correos semanales para invitarte a suscribirte y los de aliento para seguir entrenando. Los avisos importantes de tu cuenta y de tus pagos no cambian.
            </p>
            <form action={unsubscribe} className="mt-5">
              <input type="hidden" name="t" value={t} />
              <Button type="submit">Sí, dejar de recibirlos</Button>
            </form>
          </>
        )}
      </Card>
    </section>
  );
}
