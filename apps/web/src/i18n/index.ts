import { library } from "./es-AR/library";

/**
 * Textos de interfaz por idioma. Hoy solo es-AR; para agregar otro idioma se suma un diccionario
 * con la misma forma (el tipo lo exige) y se elige según la preferencia del usuario.
 * El CONTENIDO de los planes no pasa por acá: se muestra tal como viene de la base.
 */
export const messages = { library } as const;
export type Messages = typeof messages;

/** Reemplaza {nombre} por el valor correspondiente. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const t = messages;
