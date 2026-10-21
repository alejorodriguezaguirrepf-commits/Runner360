"use client";

import { useEffect } from "react";
import type { InstallPromptEvent } from "@/lib/pwa";
import { captureInstallPrompt, markInstalled } from "./install-store";

/** Registra el service worker (solo en producción) y escucha los avisos de instalación del navegador. */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      captureInstallPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => markInstalled();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
