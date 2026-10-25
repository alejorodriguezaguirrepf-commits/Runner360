/** Estado estándar devuelto por las Server Actions de formularios. */
export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Caso especial que el formulario muestra a su manera (p. ej. "email_exists" en el registro). */
  code?: string;
}

export const initialActionState: ActionState = { ok: false };
