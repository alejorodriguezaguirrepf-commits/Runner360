"use server";

import { emailOnlySchema, fieldErrors, formDataToObject, newPasswordSchema, signInSchema, signUpSchema } from "@runner360/shared";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { LEGAL_VERSIONS } from "@/lib/legal";
import { logError } from "@/lib/log";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: ActionState = {
  ok: false,
  message: "La autenticación está pendiente de configuración (faltan las credenciales de Supabase).",
};

/** Evita redirecciones abiertas: solo rutas internas. */
function safeNext(next: unknown, fallback: string): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

async function limited(bucket: string, limit = 10): Promise<ActionState | null> {
  const key = `${bucket}:${clientKey(await headers())}`;
  const r = rateLimit(key, limit, 10 * 60 * 1000);
  return r.ok ? null : { ok: false, message: `Demasiados intentos. Probá de nuevo en ${Math.ceil(r.retryAfterS / 60)} min.` };
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = signUpSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "Revisá los datos ingresados." };
  const blocked = await limited("signup", 5);
  if (blocked) return blocked;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/onboarding`,
      data: {
        display_name: parsed.data.displayName,
        accepted_terms_version: LEGAL_VERSIONS.terms,
        accepted_privacy_version: LEGAL_VERSIONS.privacy,
      },
    },
  });
  if (error) {
    logError("signUp", error);
    return { ok: false, message: "No pudimos crear la cuenta. Verificá el correo o probá más tarde." };
  }
  if (data.session) redirect("/onboarding");
  // Mensaje genérico: no revela si el correo ya estaba registrado.
  return { ok: true, message: "Te enviamos un correo para confirmar tu cuenta. Revisá tu bandeja de entrada (y el correo no deseado)." };
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const raw = formDataToObject(formData);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const blocked = await limited("signin", 10);
  if (blocked) return blocked;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { ok: false, message: "Confirmá tu correo antes de ingresar." };
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }
  redirect(safeNext(raw.next, "/inicio"));
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = emailOnlySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const blocked = await limited("reset", 5);
  if (blocked) return blocked;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/restablecer`,
  });
  if (error) logError("resetPassword", error);
  return { ok: true, message: "Si el correo está registrado, vas a recibir un enlace para restablecer tu contraseña." };
}

export async function updatePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = newPasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "El enlace venció. Pedí uno nuevo." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logError("updatePassword", error);
    return { ok: false, message: "No pudimos actualizar la contraseña. Probá con otra." };
  }
  return { ok: true, message: "Contraseña actualizada. Ya podés seguir usando RUNNER 360." };
}
