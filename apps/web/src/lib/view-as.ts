/**
 * "Ver como usuario" (solo administradores). La cookie la pone una acción del servidor que verifica
 * el rol; el cliente de Supabase la manda como encabezado x-r360-view-as y la base, con ese
 * encabezado, le QUITA al admin sus permisos (nunca da permisos a nadie).
 */
export const VIEW_AS_COOKIE = "r360_view_as";
export const VIEW_AS_HEADER = "x-r360-view-as";
export type ViewAs = "free" | "premium";

export function parseViewAs(value: string | undefined | null): ViewAs | null {
  return value === "free" || value === "premium" ? value : null;
}
