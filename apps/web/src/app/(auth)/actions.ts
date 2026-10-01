"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LEGAL_VERSIONS } from "@runner360/shared";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { bool, str, zodToState, type ActionState } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

const NOT_CONFIGURED: ActionState = {
  ok: false,
  message: "La autenticación todavía no está configurada en este entorno (faltan las credenciales de Supabase).",
};
const TOO_MANY: ActionState = { ok: false, message: "Demasiados intentos. Esperá unos minutos y volvé a intentar." };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

const email = z.email("Ingresá un correo válido").max(254);
const password = z
  .string()
  .min(8, "Usá al menos 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[A-Za-z]/, "Incluí al menos una letra")
  .regex(/\d/, "Incluí al menos un número");

export async function signInAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email, password: z.string().min(1, "Ingresá tu contraseña") }).safeParse({
    email: str(fd, "email").toLowerCase(),
    password: String(fd.get("password") ?? ""),
  });
  if (!parsed.success) return zodToState(parsed.error);
  if (!rateLimit(`login:${await clientIp()}:${parsed.data.email}`, 8, 10 * 60_000)) return TOO_MANY;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, message: "Confirmá tu correo electrónico antes de ingresar. Revisá tu bandeja de entrada." };
    }
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }
  redirect(safeNext(str(fd, "next")));
}

export async function signUpAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const schema = z
    .object({
      displayName: z.string().trim().min(2, "Ingresá al menos 2 caracteres").max(60),
      email,
      password,
      confirm: z.string(),
      accept: z.literal(true, "Necesitás aceptar los términos y la política de privacidad"),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });
  const parsed = schema.safeParse({
    displayName: str(fd, "displayName"),
    email: str(fd, "email").toLowerCase(),
    password: String(fd.get("password") ?? ""),
    confirm: String(fd.get("confirm") ?? ""),
    accept: bool(fd, "accept"),
  });
  if (!parsed.success) return zodToState(parsed.error);
  if (!rateLimit(`signup:${await clientIp()}`, 5, 60 * 60_000)) return TOO_MANY;

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
    if (error.code === "weak_password") return { ok: false, message: "La contraseña es demasiado débil." };
    // Mensaje genérico: no revelar si el correo ya está registrado.
    return { ok: false, message: "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente." };
  }
  if (data.session) redirect("/onboarding");
  return {
    ok: true,
    message: "Te enviamos un correo para confirmar tu cuenta. Abrí el enlace para continuar con tu perfil de corredor.",
  };
}

export async function requestPasswordResetAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email }).safeParse({ email: str(fd, "email").toLowerCase() });
  if (!parsed.success) return zodToState(parsed.error);
  if (!rateLimit(`reset:${await clientIp()}`, 5, 60 * 60_000)) return TOO_MANY;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/restablecer`,
  });
  return {
    ok: true,
    message: "Si el correo corresponde a una cuenta, vas a recibir un enlace para restablecer tu contraseña.",
  };
}

export async function updatePasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" })
    .safeParse({ password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") });
  if (!parsed.success) return zodToState(parsed.error);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, message: "El enlace expiró. Pedí uno nuevo desde “Olvidé mi contraseña”." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: "No pudimos actualizar la contraseña. Probá con otra." };
  redirect("/app?mensaje=contrasena-actualizada");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
