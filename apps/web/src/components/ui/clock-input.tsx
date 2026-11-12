"use client";

import { useState, type ComponentProps } from "react";
import { clockFromDigits } from "@/lib/calculator";

type Props = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type" | "inputMode"> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
};

/**
 * Campo de tiempo: se escriben solo números y los dos puntos están siempre ("1320" → "13:20").
 * Vacío muestra "0:00" de guía. Sirve controlado (value/onChange) o dentro de un formulario (name).
 */
export function ClockInput({ value, defaultValue, onChange, placeholder = "0:00", ...props }: Props) {
  const [own, setOwn] = useState(() => clockFromDigits(defaultValue ?? ""));
  const shown = value !== undefined ? clockFromDigits(value) : own;
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={shown}
      onChange={(e) => {
        const next = clockFromDigits(e.target.value);
        if (value === undefined) setOwn(next);
        onChange?.(next);
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        // El cursor siempre al final: los números entran por la derecha.
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
    />
  );
}
