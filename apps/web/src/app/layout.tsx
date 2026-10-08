import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "RUNNER 360 — Entrená. Medí. Progresá.",
    template: "%s · RUNNER 360",
  },
  description:
    "Plataforma de entrenamiento para corredores: planes de 5K a maratón, registro de entrenamientos, hidratación, competencias y evolución. Versión beta en desarrollo.",
  applicationName: "RUNNER 360",
};

export const viewport: Viewport = {
  themeColor: "#122438",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-lime-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-navy-900">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
