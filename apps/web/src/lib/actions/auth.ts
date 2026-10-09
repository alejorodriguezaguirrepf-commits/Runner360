"use server";

import { emailOnlySchema, fieldErrors, formDataToObject, newPasswordSchema, signInSchema, signUpSchema } from "@runner360/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { authErrorMessage } from "@/lib/auth-errors";
import { AUTH_UNAVAILABLE_MESSAGE, isSupabaseConfigured, missingSupabaseConfig, publicEnv, readEnv } from "@/lib/env";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { pickSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

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

  let session = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/onboarding`,
        data: {
          display_name: parsed.data.displayName,
          accepted_terms_version: LEGAL_VERSIONS.terms,
          accepted_privacy_version: LEGAL_VERSIONS.privacy,
        },
      },
    });
    if (error) {
      logError("signUp", error);
      return { ok: false, message: authErrorMessage(error, "signup") };
    }
    session = Boolean(data.session);
  } catch (e) {
    logError("signUp:exception", e);
    return { ok: false, message: authErrorMessage(e, "signup") };
  }
  // Con la confirmación por correo desactivada, la sesión se crea en el acto.
  if (session) redirect("/onboarding");
  // Mensaje genérico: no revela si el correo ya estaba registrado.
  return {
    ok: true,
    message: "¡Listo! Te enviamos un correo para confirmar tu cuenta. Abrí el enlace desde este mismo navegador (revisá también el correo no deseado).",
  };
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
