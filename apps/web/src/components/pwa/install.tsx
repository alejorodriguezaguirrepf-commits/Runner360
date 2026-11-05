"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconAddSquare, IconCheck, IconDots, IconPhone, IconShare } from "@/components/ui/icons";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { shouldShowInstallBanner, type Browser, type DesktopOs } from "@/lib/pwa";
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

const OS_LABEL: Record<DesktopOs, string> = { windows: "Windows", mac: "Mac", linux: "Linux" };

/** Computadora: instalar desde el navegador (Chrome, Edge, Safari) o descargar un acceso directo (cualquiera). */
function DesktopSteps({ browser, os }: { browser: Browser; os: DesktopOs }) {
  const others = (["windows", "mac", "linux"] as DesktopOs[]).filter((o) => o !== os);
  return (
    <div className="space-y-4">
      {browser === "chrome" || browser === "edge" ? (
        <ol className="space-y-3">
          <Step n={1} icon={<IconDots />}>
            Abrí el menú del navegador ({browser === "edge" ? <>los <strong>tres puntos</strong> “…”</> : <>los <strong>tres puntos</strong> “⋮”</>}, arriba a la derecha).
          </Step>
          <Step n={2} icon={<IconAddSquare />}>
            {browser === "edge" ? (
              <>Elegí <strong>Aplicaciones</strong> → <strong>Instalar este sitio como una aplicación</strong>.</>
            ) : (
              <>Elegí <strong>Transmitir, guardar y compartir</strong> → <strong>Instalar página como aplicación</strong> (o <strong>Crear acceso directo</strong>).</>
            )}
          </Step>
          <Step n={3} icon={<IconCheck />}>
            Confirmá con <strong>Instalar</strong>. Queda un ícono en el escritorio y en el menú de inicio.
          </Step>
        </ol>
      ) : browser === "safari" ? (
        <ol className="space-y-3">
          <Step n={1} icon={<IconShare />}>
            En la barra de menú de Safari, abrí <strong>Archivo</strong>.
          </Step>
          <Step n={2} icon={<IconAddSquare />}>
            Elegí <strong>Agregar al Dock</strong> y confirmá con <strong>Agregar</strong>.
          </Step>
        </ol>
      ) : (
        <p className="text-sm text-muted">Este navegador no instala apps, pero podés descargar un acceso directo y dejarlo en el escritorio.</p>
      )}
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-semibold text-ink">Acceso directo para el escritorio</p>
        <p className="mt-1 text-sm text-muted">Funciona en cualquier navegador: descargalo y movelo al escritorio. Al abrirlo entrás a RUNNER 360.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a href={`/acceso-directo?so=${os}`} download className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
            Descargar acceso directo ({OS_LABEL[os]})
          </a>
          {others.map((o) => (
            <a key={o} href={`/acceso-directo?so=${o}`} download className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-ink underline">
              Para {OS_LABEL[o]}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * "Descargá la app": botón directo donde el navegador lo permite (Chrome, Edge, Android) y, si no,
 * los pasos del dispositivo en el que se está (iPhone, Android o computadora) primero; los demás,
 * plegados más abajo.
 */
export function InstallGuide() {
  const s = useInstallState();
  const [status, setStatus] = useState<"idle" | "done" | "later">("idle");
  if (!s.ready) return null;
  if (s.standalone || s.installed || status === "done") {
    return (
      <Card>
        <CardTitle>Ya tenés la app instalada</CardTitle>
        <p className="text-sm text-muted">Abrí RUNNER 360 desde el ícono de tu pantalla de inicio o de tu escritorio.</p>
      </Card>
    );
  }
  const sections = {
    ios: { title: "En iPhone o iPad (Safari)", body: <IosSteps /> },
    android: { title: "En Android (Chrome)", body: <AndroidSteps /> },
    desktop: { title: "En la computadora", body: <DesktopSteps browser={s.browser} os={s.os} /> },
  } as const;
  const order = ([s.platform, ...(["ios", "android", "desktop"] as const).filter((p) => p !== s.platform)] as const);
  const [mine, ...rest] = order;
  return (
    <div className="space-y-4">
      {s.canPrompt ? (
        <Card>
          <CardTitle>Instalar en este dispositivo</CardTitle>
          <p className="mb-4 text-sm text-muted">
            {s.platform === "desktop" ? "Queda un ícono en el escritorio y se abre como una app, en su propia ventana." : "Se agrega el ícono a tu pantalla de inicio y se abre como una app, sin la barra del navegador."}
          </p>
          <Button type="button" className="w-full sm:w-auto" onClick={async () => setStatus((await promptInstall()) ? "done" : "later")}>
            {s.platform === "desktop" ? "Instalar en la computadora" : "Agregar a la pantalla de inicio"}
          </Button>
          {status === "later" ? <p className="mt-3 text-sm text-muted">No se instaló. Podés volver a intentarlo cuando quieras.</p> : null}
        </Card>
      ) : null}
      <Card>
        <CardTitle>{sections[mine].title}</CardTitle>
        {sections[mine].body}
      </Card>
      <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink">Otros dispositivos</summary>
        <div className="mt-3 space-y-6">
          {rest.map((p) => (
            <section key={p} aria-label={sections[p].title}>
              <h3 className="mb-3 font-bold text-ink">{sections[p].title}</h3>
              {sections[p].body}
            </section>
          ))}
        </div>
      </details>
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
        <strong>Instalá RUNNER 360</strong> en tu celular y abrila como una app. Si ya la tenías instalada, borrá el ícono viejo e instalala de nuevo desde acá.
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
