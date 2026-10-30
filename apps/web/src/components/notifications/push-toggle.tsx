"use client";

import { useEffect, useState } from "react";
import { deletePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/notifications";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js");
}

/**
 * Activa o desactiva los avisos push en este dispositivo. En iPhone solo funciona con la app
 * instalada en la pantalla de inicio (iOS 16.4 o posterior).
 */
export function PushToggle({ vapidPublicKey, label = "Avisos en este dispositivo" }: { vapidPublicKey: string; label?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<State> {
      if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      try {
        return (await (await registration()).pushManager.getSubscription()) ? "on" : "off";
      } catch {
        return "off";
      }
    }
    detect().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState("denied");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
      const res = await savePushSubscriptionAction(sub.toJSON());
      if (!res.ok) throw new Error("save");
      setState("on");
    } catch {
      setError("No pudimos activar los avisos. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await deletePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("No pudimos desactivar los avisos. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{label}</p>
          <p className="text-muted">
            {state === "on"
              ? "Activados: te avisamos al instante."
              : state === "denied"
                ? "El navegador los tiene bloqueados: habilitá las notificaciones de este sitio en la configuración del navegador."
                : state === "unsupported"
                  ? "Este navegador no permite avisos. En iPhone, instalá la app en la pantalla de inicio y abrila desde ahí."
                  : "Desactivados."}
          </p>
        </div>
        {state === "on" ? (
          <button type="button" onClick={disable} disabled={busy} className="min-h-11 rounded-xl border border-line px-4 font-semibold text-ink">
            {busy ? "…" : "Desactivar"}
          </button>
        ) : state === "off" ? (
          <button type="button" onClick={enable} disabled={busy} className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary">
            {busy ? "Activando…" : "Activar"}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-danger">{error}</p> : null}
    </div>
  );
}
