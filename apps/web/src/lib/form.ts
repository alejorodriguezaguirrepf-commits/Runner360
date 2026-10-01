import type { ZodError } from "zod";

export type FormValues = Record<string, string | string[]>;

export type ActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors?: Record<string, string>;
  /** Valores enviados, para repoblar el formulario si hay errores (React 19 resetea los formularios tras una acción). */
  values?: FormValues;
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

/** Copia los valores del formulario (excluye contraseñas y campos internos de Next). */
export function formValues(fd: FormData): FormValues {
  const out: FormValues = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v !== "string" || k.startsWith("$ACTION") || /password|confirm/i.test(k)) continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

export function withValues(state: ActionState, fd: FormData): ActionState {
  return state.ok ? state : { ...state, values: formValues(fd) };
}

/** Lee un valor repoblado como cadena. */
export function v(values: FormValues | undefined, key: string, fallback = ""): string {
  const x = values?.[key];
  return typeof x === "string" ? x : Array.isArray(x) ? (x[0] ?? fallback) : fallback;
}
export function vList(values: FormValues | undefined, key: string): string[] | null {
  if (!values) return null;
  const x = values[key];
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}
