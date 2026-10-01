import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "lime" | "navy" | "warning" | "danger" | "success";
const tones: Record<Tone, string> = {
  neutral: "bg-surface text-muted border border-line",
  lime: "bg-lime text-navy",
  navy: "bg-navy text-white",
  warning: "bg-warning-bg text-warning border border-warning/30",
  danger: "bg-danger-bg text-danger border border-danger/30",
  success: "bg-success-bg text-success border border-success/30",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Etiqueta obligatoria para cualquier plan o dato de demostración. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={className}>
      DEMO / NO VALIDADO
    </Badge>
  );
}
