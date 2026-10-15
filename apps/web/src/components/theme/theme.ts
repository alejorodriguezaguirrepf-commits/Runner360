/**
 * Tema visual. Preferencia guardada en este dispositivo (localStorage "r360-theme"):
 *  - "light"  (por defecto para usuarios nuevos)
 *  - "dark"
 *  - "system" (sigue la preferencia del sistema operativo)
 * El tema efectivo se aplica como data-theme="light|dark" en <html>; los colores salen de los
 * tokens de globals.css, así que ningún componente se duplica por tema.
 */
export type ThemePreference = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "r360-theme";

/**
 * Script que corre antes de pintar la página (en <head>) para evitar el destello del tema
 * equivocado. Sin dependencias: se inserta como texto.
 */
export const THEME_SCRIPT = `(function(){var k="${THEME_STORAGE_KEY}",d=document.documentElement,m;function a(p){var dark=p==="dark"||(p==="system"&&m&&m.matches);d.dataset.theme=dark?"dark":"light";}try{m=window.matchMedia("(prefers-color-scheme: dark)");var p=localStorage.getItem(k)||"light";a(p);m.addEventListener("change",function(){var q=localStorage.getItem(k)||"light";if(q==="system")a(q);});}catch(e){d.dataset.theme="light";}})();`;

export function applyTheme(pref: ThemePreference): void {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Almacenamiento no disponible (modo privado): el tema se aplica solo en esta visita.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

const THEME_EVENT = "r360-theme-change";

/** Suscripción para useSyncExternalStore: cambios en esta pestaña o en otra. */
export function subscribeThemePreference(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
