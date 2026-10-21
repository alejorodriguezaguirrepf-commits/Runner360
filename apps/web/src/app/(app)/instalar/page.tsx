import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/install";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Instalar app" };

export default function InstallPage() {
  return (
    <>
      <PageHeader title="Instalar app" subtitle="Tené RUNNER 360 en la pantalla de inicio de tu celular, como cualquier otra app." />
      <InstallGuide />
    </>
  );
}
