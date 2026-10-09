/**
 * Traduce errores del servicio de autenticación a mensajes claros en español para el usuario
 * final. Nunca expone nombres de proveedores, variables ni detalles técnicos (eso va a los logs).
 */

export type AuthContext = "signup" | "signin" | "reset" | "update";

interface ErrorLike {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
}

const CONNECTION =
  "No pudimos conectarnos con el servicio de cuentas. Revisá tu conexión e intentá de nuevo en unos minutos.";

export function authErrorMessage(error: unknown, context: AuthContext): string {
  const e = (typeof error === "object" && error ? error : {}) as ErrorLike;
  const code = e.code ?? "";
  const msg = (e.message ?? "").toLowerCase();

  if (e.name === "AuthRetryableFetchError" || e.status === 0 || /fetch failed|network|econnrefused|enotfound/.test(msg)) {
    return CONNECTION;
  }
  if (code === "over_email_send_rate_limit" || /email rate limit/.test(msg)) {
    return "Se enviaron demasiados correos en poco tiempo. Esperá unos minutos y volvé a intentar.";
  }
  if (code === "over_request_rate_limit" || e.status === 429) {
    return "Demasiados intentos seguidos. Esperá unos minutos y volvé a intentar.";
  }

  switch (context) {
    case "signup":
      if (code === "user_already_exists" || code === "email_exists" || /already registered/.test(msg)) {
        return "Ya existe una cuenta con ese correo. Ingresá o recuperá tu contraseña.";
      }
      if (code === "weak_password") return "La contraseña es demasiado débil. Usá al menos 10 caracteres, con letras y números.";
      if (code === "email_address_invalid" || code === "validation_failed") return "Revisá el correo electrónico: no parece válido.";
      if (code === "signup_disabled" || code === "email_provider_disabled") {
        return "Por el momento no estamos aceptando registros nuevos. Probá más tarde.";
      }
      return "No pudimos crear la cuenta. Intentá de nuevo en unos minutos.";
    case "signin":
      if (code === "email_not_confirmed") {
        return "Todavía no confirmaste tu correo. Abrí el enlace que te enviamos (revisá también el correo no deseado).";
      }
      if (code === "invalid_credentials" || e.status === 400) return "Correo o contraseña incorrectos.";
      return "No pudimos iniciar sesión. Intentá de nuevo en unos minutos.";
    case "update":
      if (code === "same_password") return "La contraseña nueva tiene que ser distinta de la anterior.";
      if (code === "weak_password") return "La contraseña es demasiado débil. Usá al menos 10 caracteres, con letras y números.";
      return "No pudimos actualizar la contraseña. Intentá de nuevo.";
    case "reset":
      return "No pudimos enviar el correo de recuperación. Intentá de nuevo en unos minutos.";
  }
}
