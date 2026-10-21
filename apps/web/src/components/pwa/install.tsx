"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconAddSquare, IconCheck, IconDots, IconPhone, IconShare } from "@/components/ui/icons";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { shouldShowInstallBanner } from "@/lib/pwa";
import { dismissInstall, promptInstall, useInstallState } from "./install-store";

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">{n}</span>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-primary-ink">{icon}</span>
      <span className="text-sm">{children}</span>
    </li>
  );
}

/** Dibujo de la barra de Safari con el botón Compartir señalado. */
function SafariBar() {
  return (
    <div aria-hidden className="mx-auto mt-2 flex max-w-xs items-center justify-around rounded-2xl border border-line bg-surface-2 px-4 py-2 text-muted">
      <span className="text-lg">‹</span>
      <span className="text-lg">›</span>
      <span className="relative inline-flex size-10 items-center justify-center rounded-full bg-accent text-on-accent ring-4 ring-accent/30"><IconShare /></span>
      <span className="text-lg">▢</span>
      <span className="text-lg">▤</span>
    </div>
  );
}

function IosSteps() {
  return (
    <>
      <ol className="space-y-3">
        <Step n={1} icon={<IconShare />}>
          Abrí esta página en <strong>Safari</strong> y tocá el botón <strong>Compartir</strong> (abajo, en el centro).
        </Step>
        <Step n={2} icon={<IconAddSquare />}>
          Bajá en la lista y tocá <strong>Agregar a inicio</strong>.
        </Step>
        <Step n={3} icon={<IconCheck />}>
          Tocá <strong>Agregar</strong>. El ícono de RUNNER 360 queda en tu pantalla de inicio.
        </Step>
      </ol>
      <SafariBar />
    </>
  );
}

function AndroidSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1} icon={<IconDots />}>
        Tocá el menú del navegador (los <strong>tres puntos</strong>, arriba a la derecha).
      </Step>
      <Step n={2} icon={<IconPhone />}>
        Elegí <strong>Instalar app</strong> o <strong>Agregar a la pantalla principal</strong>.
      </Step>
      <Step n={3} icon={<IconCheck />}>
        Confirmá con <strong>Instalar</strong>.
      </Step>
    </ol>
  );
}

/** Pantalla "Instalar app": botón directo en Android/Chrome e instrucciones con dibujos en iPhone. */
export function InstallGuide() {
  const s = useInstallState();
  const [status, setStatus] = useState<"idle" | "done" | "later">("idle");
  if (!s.ready) return null;
  if (s.standalone || s.installed || status === "done") {
    return (
      <Card>
        <CardTitle>Ya tenés la app instalada</CardTitle>
        <p className="text-sm text-muted">Abrí RUNNER 360 desde el ícono de tu pantalla de inicio.</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {s.canPrompt ? (
        <Card>
          <CardTitle>Instalar en este dispositivo</CardTitle>
          <p className="mb-4 text-sm text-muted">Se agrega el ícono a tu pantalla de inicio y se abre como una app, sin la barra del navegador.</p>
          <Button type="button" className="w-full sm:w-auto" onClick={async () => setStatus((await promptInstall()) ? "done" : "later")}>
            Agregar a la pantalla de inicio
          </Button>
          {status === "later" ? <p className="mt-3 text-sm text-muted">No se instaló. Podés volver a intentarlo cuando quieras.</p> : null}
        </Card>
      ) : null}
      <Card>
        <CardTitle>En iPhone (Safari)</CardTitle>
        <IosSteps />
      </Card>
      {!s.canPrompt ? (
        <Card>
          <CardTitle>En Android (Chrome)</CardTitle>
          <AndroidSteps />
        </Card>
      ) : null}
    </div>
  );
}

/** Aviso discreto la primera vez que se entra desde el celular. Se cierra y no vuelve. */
export function InstallBanner() {
  const s = useInstallState();
  const pathname = usePathname();
  if (!s.ready || pathname === "/instalar" || !shouldShowInstallBanner(s)) return null;
  return (
    <aside aria-label="Instalar la app" className="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><IconPhone /></span>
      <p className="min-w-0 flex-1 text-sm">
        <strong>Instalá RUNNER 360</strong> en tu celular y abrila como una app.
      </p>
      {s.canPrompt ? (
        <button type="button" onClick={() => void promptInstall()} className="min-h-11 shrink-0 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">
          Instalar
        </button>
      ) : (
        <Link href="/instalar" onClick={dismissInstall} className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary">
          Cómo
        </Link>
      )}
      <button type="button" onClick={dismissInstall} aria-label="Cerrar el aviso de instalación" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-xl text-muted hover:text-ink">
        ×
      </button>
    </aside>
  );
}
