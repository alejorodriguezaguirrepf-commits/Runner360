"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconAddSquare, IconCheck, IconDots, IconPhone, IconShare } from "@/components/ui/icons";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { openInChromeHref, openInSafariHref, shouldShowInstallBanner, type Browser, type DesktopOs, type InAppBrowser } from "@/lib/pwa";
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

/** Acceso directo descargable para iPhone: un perfil que agrega el ícono (solo se puede instalar desde Safari). */
function IosShortcutDownload() {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-sm font-semibold text-ink">¿Preferís descargar el acceso directo?</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Tocá <strong className="text-ink">Descargar acceso directo</strong> y después <strong className="text-ink">Permitir</strong>.</li>
        <li>Abrí <strong className="text-ink">Configuración</strong> y tocá <strong className="text-ink">Perfil descargado</strong> (arriba de todo).</li>
        <li>Tocá <strong className="text-ink">Instalar</strong> y poné el código de tu iPhone. El ícono de RUNNER 360 aparece en tu pantalla de inicio.</li>
      </ol>
      <p className="mt-2 text-xs text-muted">El iPhone puede marcarlo como “No verificado”: es normal en accesos directos de sitios web. Solo agrega el ícono y lo borrás como cualquier otro.</p>
      <a href="/acceso-directo?so=ios" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
        Descargar acceso directo (iPhone)
      </a>
    </div>
  );
}

function IosSteps({ browser }: { browser: Browser }) {
  const safari = browser === "safari";
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        <Step n={1} icon={<IconShare />}>
          {safari ? (
            <>Tocá el botón <strong>Compartir</strong>: está abajo, en el centro, o dentro del botón <strong>•••</strong> (abajo a la derecha) en los iPhone con la versión más nueva.</>
          ) : browser === "chrome" ? (
            <>Tocá el botón <strong>Compartir</strong>, arriba a la derecha, al lado de la dirección.</>
          ) : (
            <>Abrí el menú del navegador y tocá <strong>Compartir</strong>.</>
          )}
        </Step>
        <Step n={2} icon={<IconAddSquare />}>
          Bajá en la lista (o tocá <strong>Ver más</strong>) y elegí <strong>Agregar a inicio</strong>.
        </Step>
        <Step n={3} icon={<IconCheck />}>
          Tocá <strong>Agregar</strong>. El ícono de RUNNER 360 queda en tu pantalla de inicio.
        </Step>
      </ol>
      {safari ? (
        <IosShortcutDownload />
      ) : (
        <p className="text-sm text-muted">Si no aparece <strong className="text-ink">Agregar a inicio</strong>, abrí <strong className="text-ink">runner360.ar</strong> en Safari y repetí los pasos.</p>
      )}
    </div>
  );
}

/**
 * Página abierta dentro de otra app (Instagram, Facebook…): ahí no se puede instalar. Botón para
 * pasar a Safari o Chrome, copiar el enlace y, por las dudas, cómo hacerlo desde el menú de la app.
 */
function OpenOutside({ app, ios }: { app: InAppBrowser; ios: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const name = app === "app" ? "otra app" : app;
  const target = ios ? "Safari" : "Chrome";
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copiá este enlace:", url);
    }
  }
  return (
    <Card>
      <CardTitle>Primero abrila en {target}</CardTitle>
      <p className="mb-4 text-sm text-muted">
        Estás viendo RUNNER 360 dentro de {name}. Desde acá {ios ? "el iPhone" : "el teléfono"} no deja agregar la app a la pantalla de inicio: abrí esta página en {target} y seguí los pasos de abajo.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={ios ? openInSafariHref(url) : openInChromeHref(url)} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
          Abrir en {target}
        </a>
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink">
          {copied ? "Enlace copiado" : "Copiar enlace"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted" role="status">
        {copied ? <>Abrí {target}, tocá la barra de direcciones y pegá el enlace.</> : <>Si el botón no hace nada, tocá los <strong className="text-ink">tres puntos</strong> {ios ? "(•••)" : "(⋮)"} arriba a la derecha y elegí <strong className="text-ink">Abrir en el navegador externo</strong> (o <strong className="text-ink">Abrir en {target}</strong>).</>}
      </p>
    </Card>
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
    ios: { title: s.platform === "ios" && s.browser !== "safari" && !s.inApp ? "En iPhone o iPad" : "En iPhone o iPad (Safari)", body: <IosSteps browser={s.platform === "ios" && !s.inApp ? s.browser : "safari"} /> },
    android: { title: "En Android (Chrome)", body: <AndroidSteps /> },
    desktop: { title: "En la computadora", body: <DesktopSteps browser={s.browser} os={s.os} /> },
  } as const;
  const order = ([s.platform, ...(["ios", "android", "desktop"] as const).filter((p) => p !== s.platform)] as const);
  const [mine, ...rest] = order;
  return (
    <div className="space-y-4">
      {s.inApp && s.platform !== "desktop" ? <OpenOutside app={s.inApp} ios={s.platform === "ios"} /> : null}
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
