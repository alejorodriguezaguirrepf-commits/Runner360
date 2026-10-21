"use client";

import { useSyncExternalStore } from "react";
import { DISMISS_KEY, INSTALLED_KEY, detectPlatform, type InstallPromptEvent, type Platform } from "@/lib/pwa";

// El navegador avisa una sola vez que se puede instalar (beforeinstallprompt), a veces antes de que
// se abra la pantalla "Instalar app": se guarda acá y lo usan el botón y el aviso.
let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function captureInstallPrompt(e: InstallPromptEvent) {
  deferred = e;
  emit();
}
export function markInstalled() {
  installedNow = true;
  deferred = null;
  safeSet(INSTALLED_KEY, "1");
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): el aviso puede volver a aparecer; no es grave.
  }
}

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallState = { ready: boolean; platform: Platform; standalone: boolean; installed: boolean; dismissed: boolean; canPrompt: boolean };

const SERVER: InstallState = { ready: false, platform: "desktop", standalone: false, installed: false, dismissed: true, canPrompt: false };
let cache: InstallState = SERVER;

function snapshot(): InstallState {
  const next: InstallState = {
    ready: true,
    platform: detectPlatform(navigator.userAgent, navigator.maxTouchPoints, navigator.platform),
    standalone: isStandalone(),
    installed: installedNow || safeGet(INSTALLED_KEY) === "1",
    dismissed: safeGet(DISMISS_KEY) === "1",
    canPrompt: deferred !== null,
  };
  const same = (Object.keys(next) as (keyof InstallState)[]).every((k) => next[k] === cache[k]);
  if (!same) cache = next;
  return cache;
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

export function dismissInstall() {
  safeSet(DISMISS_KEY, "1");
  emit();
}

/** Abre el diálogo de instalación del navegador (Android/Chrome). true si la persona aceptó. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  emit();
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") markInstalled();
  return outcome === "accepted";
}
