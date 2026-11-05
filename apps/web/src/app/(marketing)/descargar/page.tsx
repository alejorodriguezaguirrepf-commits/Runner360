import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/install";

export const metadata: Metadata = {
  title: "Descargá la app",
  description: "Instalá RUNNER 360 en tu celular o en tu computadora y abrila desde un ícono, como cualquier app.",
};

/** Página pública: cualquiera puede instalar la app o bajarse un acceso directo, con o sin cuenta. */
export default function DownloadPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Descargá la app</h1>
      <p className="mt-2 mb-8 text-muted">
        Tené RUNNER 360 a un toque: un ícono en la pantalla de inicio de tu celular o en el escritorio de tu computadora. No ocupa lugar y se actualiza sola.
      </p>
      <InstallGuide />
    </section>
  );
}
