"use client";

import { formatDate } from "@runner360/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { IconFingerprint } from "@/components/ui/icons";
import { Button, Card, CardTitle } from "@/components/ui/primitives";
import { removePasskeyAction } from "@/lib/actions/passkeys";
import { canUseBiometrics, registerBiometrics, signInWithBiometrics, supportsPasskeys } from "@/lib/passkeys/client";

const noop = () => () => {};
/** El navegador permite llaves de acceso (se sabe recién en el navegador; en el servidor, no). */
function usePasskeySupport(): boolean {
  return useSyncExternalStore(noop, supportsPasskeys, () => false);
}
/** El dispositivo tiene huella, Face ID o bloqueo de pantalla (se consulta al sistema). */
function useBiometricsAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void canUseBiometrics().then((v) => {
      if (alive) setAvailable(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return available;
}

/** Ingresar: botón para entrar con la huella guardada en este dispositivo. */
export function BiometricSignIn({ next }: { next: string }) {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supported) return null;
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full gap-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await signInWithBiometrics(next);
          if (r.ok) {
            window.location.assign(r.redirect ?? "/inicio");
            return;
          }
          setError(r.error);
          setBusy(false);
        }}
      >
        <IconFingerprint /> {busy ? "Verificando…" : "Ingresar con huella o Face ID"}
      </Button>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export type PasskeyItem = { id: string; device_name: string; created_at: string; last_used_at: string | null };

/** Perfil: activar en este dispositivo y ver o quitar los dispositivos con huella. */
export function BiometricsCard({ keys }: { keys: PasskeyItem[] }) {
  const available = useBiometricsAvailable();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  return (
    <Card>
      <CardTitle>Ingreso con huella</CardTitle>
      <p className="text-sm text-muted">
        Entrá con tu huella, Face ID o el bloqueo de tu dispositivo, sin escribir la contraseña. Tu huella no sale de tu teléfono: RUNNER 360 no la ve ni la guarda.
      </p>
      {keys.length ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="flex items-center gap-2 font-semibold text-ink"><IconFingerprint width={16} height={16} /> {k.device_name}</span>
                <span className="block text-xs text-muted">
                  Activado el {formatDate(k.created_at.slice(0, 10))}
                  {k.last_used_at ? ` · último ingreso ${formatDate(k.last_used_at.slice(0, 10))}` : ""}
                </span>
              </span>
              <form action={removePasskeyAction}>
                <input type="hidden" name="id" value={k.id} />
                <button className="min-h-11 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-danger-bg" aria-label={`Quitar el ingreso con huella de ${k.device_name}`}>
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">
        {available === false ? (
          <p className="text-sm text-muted">Este dispositivo o navegador no tiene huella, Face ID ni bloqueo de pantalla disponibles. Probá desde tu celular.</p>
        ) : (
          <Button
            type="button"
            className="gap-2"
            disabled={busy || available === null}
            onClick={async () => {
              setBusy(true);
              setMessage(null);
              const r = await registerBiometrics();
              setBusy(false);
              if (r.ok) {
                setMessage({ tone: "ok", text: "¡Listo! La próxima vez podés ingresar con tu huella desde este dispositivo." });
                router.refresh();
              } else setMessage({ tone: "error", text: r.error });
            }}
          >
            <IconFingerprint /> {busy ? "Esperando tu huella…" : "Activar en este dispositivo"}
          </Button>
        )}
        {message ? (
          <p role="status" className={`mt-3 text-sm ${message.tone === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p>
        ) : null}
      </div>
    </Card>
  );
}

const DISMISS_KEY = "r360-bio-dismissed";
function dismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Inicio: sugerencia (una sola vez) de activar la huella en un dispositivo que la tiene. */
export function BiometricSuggestion() {
  const available = useBiometricsAvailable();
  const wasDismissed = useSyncExternalStore(noop, dismissed, () => true);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Al activarla se marca como vista, pero el mensaje de "¡Listo!" se sigue mostrando hasta salir.
  if (!available || hidden || (wasDismissed && !message)) return null;
  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento: la sugerencia puede volver a aparecer.
    }
    setHidden(true);
  };
  return (
    <aside aria-label="Ingreso con huella" className="mb-6 rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary"><IconFingerprint /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">Ingresá más rápido con tu huella</p>
          <p className="text-sm text-muted">Activá el ingreso con huella o Face ID en este dispositivo y no vuelvas a escribir la contraseña.</p>
          {message ? <p role="status" className={`mt-2 text-sm ${message.tone === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p> : null}
          {message?.tone === "ok" ? null : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await registerBiometrics();
                  setBusy(false);
                  if (r.ok) {
                    setMessage({ tone: "ok", text: "¡Listo! La próxima vez ingresá con tu huella." });
                    try {
                      window.localStorage.setItem(DISMISS_KEY, "1");
                    } catch {
                      // Sin almacenamiento: no pasa nada.
                    }
                  } else if (!r.cancelled) setMessage({ tone: "error", text: r.error });
                }}
              >
                {busy ? "Esperando tu huella…" : "Activar"}
              </Button>
              <Button type="button" variant="ghost" onClick={close}>Ahora no</Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
