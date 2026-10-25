"use server";

import { emailOnlySchema, fieldErrors, formDataToObject, newPasswordSchema, signInSchema, signUpSchema } from "@runner360/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authErrorMessage, isEmailTaken } from "@/lib/auth-errors";
import { AUTH_UNAVAILABLE_MESSAGE, isSupabaseConfigured, missingSupabaseConfig, publicEnv, readEnv } from "@/lib/env";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { pickSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { turnstileSecret, turnstileSiteKey, verifyTurnstile } from "@/lib/turnstile";

/** Si falta configuración: mensaje claro al usuario y detalle técnico (sin valores) en los logs. */
function unavailable(context: string): ActionState {
  logError(`auth:${context}`, `Faltan variables de entorno: ${missingSupabaseConfig().join(", ")}`);
  return { ok: false, message: AUTH_UNAVAILABLE_MESSAGE };
}

/** Evita redirecciones abiertas: solo rutas internas. */
function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

async function limited(bucket: string, limit = 10): Promise<ActionState | null> {
  const key = `${bucket}:${clientKey(await headers())}`;
  const r = rateLimit(key, limit, 10 * 60 * 1000);
  return r.ok ? null : { ok: false, message: `Demasiados intentos. Probá de nuevo en ${Math.ceil(r.retryAfterS / 60)} min.` };
}

/** Dominio al que deben volver los enlaces de los correos (ver lib/site-url.ts). */
async function siteUrl(): Promise<string> {
  const h = await headers();
  return pickSiteUrl({
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    host: h.get("host"),
    configured: publicEnv.configuredSiteUrl,
    vercelProductionUrl: readEnv("VERCEL_PROJECT_PRODUCTION_URL"),
    production: process.env.NODE_ENV === "production",
  });
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return unavailable("signUp");
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Revisá los campos marcados." };
  const blocked = await limited("signup", 5);
  if (blocked) return blocked;

  // Captcha invisible: lo verifica el servidor antes de crear la cuenta.
  // Se exige solo con las dos claves cargadas (sin la pública el formulario no muestra el widget).
  const captcha = await verifyTurnstile(formData.get("cf-turnstile-response"), clientKey(await headers()), {
    secret: turnstileSiteKey() ? turnstileSecret() : "",
  });
  if (!captcha.ok) {
    if (captcha.reason !== "missing") logError("signUp:captcha", captcha.reason);
    return { ok: false, code: "captcha", message: "No pudimos verificar que no sos un robot. Esperá unos segundos y tocá de nuevo «Comenzar gratis»." };
  }

  const { email, password, displayName } = parsed.data;
  const metadata = { display_name: displayName, accepted_terms_version: LEGAL_VERSIONS.terms, accepted_privacy_version: LEGAL_VERSIONS.privacy };
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    if (admin) {
      // Registro en un paso: la cuenta se crea ya habilitada (sin correo de confirmación) desde el
      // servidor; el registro directo contra el servicio de cuentas queda apagado.
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
      if (error) return signUpFailure(error);
    } else {
      // Sin la clave de servicio (entorno local): alta directa; con la confirmación apagada crea la sesión.
      const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
      if (error) return signUpFailure(error);
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logError("signUp:signIn", error);
        return { ok: false, message: "Tu cuenta quedó creada, pero no pudimos iniciar la sesión. Ingresá con tu correo y tu contraseña." };
      }
    }
  } catch (e) {
    logError("signUp:exception", e);
    return { ok: false, message: authErrorMessage(e, "signup") };
  }
  redirect("/onboarding");
}

function signUpFailure(error: { code?: string; status?: number; message?: string }): ActionState {
  if (isEmailTaken(error)) return { ok: false, code: "email_exists", message: "Ya tenés una cuenta con este correo." };
  logError("signUp", error);
  return { ok: false, message: authErrorMessage(error, "signup") };
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return unavailable("signIn");
  const raw = formDataToObject(formData);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const blocked = await limited("signin", 10);
  if (blocked) return blocked;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      if (error.code !== "invalid_credentials") logError("signIn", error);
      return { ok: false, message: authErrorMessage(error, "signin") };
    }
  } catch (e) {
    logError("signIn:exception", e);
    return { ok: false, message: authErrorMessage(e, "signin") };
  }
  redirect(safeNext(raw.next, "/inicio"));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (e) {
      logError("signOut", e);
    }
  }
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return unavailable("resetPassword");
  const parsed = emailOnlySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const blocked = await limited("reset", 5);
  if (blocked) return blocked;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await siteUrl()}/auth/confirm?next=/restablecer`,
    });
    if (error) {
      logError("resetPassword", error);
      // Solo se informan límites o fallas de conexión; nunca si el correo existe o no.
      if (error.code === "over_email_send_rate_limit" || error.status === 429 || error.status === 0) {
        return { ok: false, message: authErrorMessage(error, "reset") };
      }
    }
  } catch (e) {
    logError("resetPassword:exception", e);
    return { ok: false, message: authErrorMessage(e, "reset") };
  }
  return {
    ok: true,
    message: "Si el correo está registrado, vas a recibir un enlace para crear una contraseña nueva. Abrilo desde este mismo navegador.",
  };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return unavailable("updatePassword");
  const parsed = newPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "El enlace venció o se abrió en otro navegador. Pedí uno nuevo desde “Olvidé mi contraseña”." };
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      logError("updatePassword", error);
      return { ok: false, message: authErrorMessage(error, "update") };
    }
  } catch (e) {
    logError("updatePassword:exception", e);
    return { ok: false, message: authErrorMessage(e, "update") };
  }
  return { ok: true, message: "Contraseña actualizada. Ya podés seguir usando RUNNER 360." };
}
