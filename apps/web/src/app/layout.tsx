import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { THEME_SCRIPT } from "@/components/theme/theme";
import { publicEnv } from "@/lib/env";
import "./globals.css";

// Inter autoalojada por next/font (sin pedidos a terceros desde el navegador).
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: {
    default: "RUNNER 360 — Entrená. Medí. Progresá.",
    template: "%s · RUNNER 360",
  },
  description:
    "Plataforma de entrenamiento para corredores: planes de 5K a maratón, registro de entrenamientos, hidratación, competencias y evolución. Versión beta en desarrollo.",
  applicationName: "RUNNER 360",
  // iPhone: al agregarla a inicio se abre como app, con su nombre y el ícono apple-icon.png.
  appleWebApp: { capable: true, title: "RUNNER 360", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101820" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme lo fija THEME_SCRIPT antes de pintar; React no lo conoce (de ahí suppressHydrationWarning).
    <html lang="es-AR" data-theme="light" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent">
          Saltar al contenido
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
