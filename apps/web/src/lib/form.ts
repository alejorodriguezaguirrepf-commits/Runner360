import type { ZodError } from "zod";

export type ActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false, message: null };

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
export function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}
export function intOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.NaN;
}
export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}
export function intList(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));
}

export function zodToState(error: ZodError, message = "Revisá los datos ingresados."): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, message, fieldErrors };
}

/** Mensaje genérico para errores de base de datos: no se exponen detalles internos al usuario. */
export function dbErrorState(context: string, error: { code?: string; message?: string } | null): ActionState {
  // Se registra solo el código: los mensajes de Postgres pueden incluir valores de la fila (datos personales).
  if (error) console.error(`[${context}] db_error`, error.code ?? "unknown");
  if (error?.code === "42501") return { ok: false, message: "No tenés permisos para realizar esta acción." };
  return { ok: false, message: "No pudimos guardar los cambios. Intentá nuevamente." };
}
