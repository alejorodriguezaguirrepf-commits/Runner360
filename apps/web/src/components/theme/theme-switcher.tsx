"use client";

import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui/primitives";
import { readThemePreference, saveThemePreference, subscribeThemePreference, type ThemePreference } from "./theme";

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "light", label: "Claro", hint: "Fondo claro (predeterminado)" },
  { value: "dark", label: "Oscuro", hint: "Menos brillo, ideal de noche" },
  { value: "system", label: "Automático", hint: "Igual que tu teléfono o computadora" },
];

/** Selector de tema: se aplica al instante y se recuerda en este dispositivo. */
export function ThemeSwitcher() {
  const pref = useSyncExternalStore(subscribeThemePreference, readThemePreference, () => "light" as ThemePreference);
  return (
    <fieldset>
      <legend className="sr-only">Tema</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={cx(
              "flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-ink",
              pref === o.value ? "border-primary-ink bg-accent text-on-accent" : "border-line bg-surface text-ink hover:border-primary",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={o.value}
              checked={pref === o.value}
              onChange={() => saveThemePreference(o.value)}
              className="sr-only"
            />
            <span className="font-semibold">{o.label}</span>
            <span className={cx("text-sm", pref === o.value ? "text-on-accent" : "text-muted")}>{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
