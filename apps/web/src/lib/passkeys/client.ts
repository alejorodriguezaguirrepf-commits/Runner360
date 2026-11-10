/**
 * Huella / Face ID en el navegador: activar en este dispositivo e ingresar. Usa las llaves de acceso
 * del sistema (WebAuthn): la huella la lee el teléfono y nunca sale de él.
 */
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";

export type Result = { ok: true; redirect?: string } | { ok: false; error: string; cancelled?: boolean };

const CANCELLED = "Se canceló. Podés intentarlo de nuevo cuando quieras.";

/** ¿Este dispositivo tiene huella, Face ID o bloqueo de pantalla para usar? */
export async function canUseBiometrics(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

export function supportsPasskeys(): boolean {
  try {
    return browserSupportsWebAuthn();
  } catch {
    return false;
  }
}

async function post(url: string, body?: unknown): Promise<Record<string, unknown> & { error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok && !data.error) data.error = "No pudimos completar la operación. Probá de nuevo.";
  return data;
}

function browserError(e: unknown, already: string): Result {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "AbortError") return { ok: false, error: CANCELLED, cancelled: true };
  if (name === "InvalidStateError") return { ok: false, error: already };
  return { ok: false, error: "Este dispositivo no pudo usar la huella. Probá de nuevo o usá tu contraseña." };
}

/** Activa el ingreso con huella en este dispositivo (con sesión iniciada). */
export async function registerBiometrics(): Promise<Result> {
  const start = await post("/api/passkeys/register/options");
  if (start.error || !start.options) return { ok: false, error: start.error ?? "No pudimos empezar. Probá de nuevo." };
  let response;
  try {
    response = await startRegistration({ optionsJSON: start.options as Parameters<typeof startRegistration>[0]["optionsJSON"] });
  } catch (e) {
    return browserError(e, "Este dispositivo ya tiene el ingreso con huella activado.");
  }
  const done = await post("/api/passkeys/register/verify", { response });
  return done.error ? { ok: false, error: done.error } : { ok: true };
}

/** Ingresa con la huella guardada en este dispositivo. */
export async function signInWithBiometrics(next: string): Promise<Result> {
  const start = await post("/api/passkeys/login/options");
  if (start.error || !start.options) return { ok: false, error: start.error ?? "No pudimos empezar. Probá de nuevo." };
  let response;
  try {
    response = await startAuthentication({ optionsJSON: start.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
  } catch (e) {
    return browserError(e, "");
  }
  const done = await post("/api/passkeys/login/verify", { response, next });
  return done.error ? { ok: false, error: done.error } : { ok: true, redirect: typeof done.redirect === "string" ? done.redirect : "/inicio" };
}
