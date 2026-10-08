/** Estado estándar devuelto por las Server Actions de formularios. */
export interface ActionState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

export const initialActionState: ActionState = { ok: false };
