import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { IconAlert, IconCheck, IconInfo } from "./icons";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-lime-400 text-navy-900 hover:bg-lime-500 shadow-sm",
  secondary: "bg-navy-900 text-white hover:bg-navy-800",
  ghost: "bg-transparent text-navy-900 hover:bg-navy-100 border border-line",
  danger: "bg-danger text-white hover:opacity-90",
};
const BTN = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 min-h-11";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(BTN, VARIANTS[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(BTN, VARIANTS[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(18,36,56,0.04)]", className)} {...props} />;
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

type Tone = "neutral" | "lime" | "navy" | "warning" | "danger" | "success";
const TONES: Record<Tone, string> = {
  neutral: "bg-navy-100 text-navy-900",
  lime: "bg-lime-300 text-navy-900",
  navy: "bg-navy-900 text-white",
  warning: "bg-warning-bg text-warning border border-warning/30",
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONES[tone], className)}>{children}</span>;
}

/** Etiqueta obligatoria para cualquier contenido de demostración. */
export function DemoBadge({ label = "DEMO / NO VALIDADO" }: { label?: string }) {
  return <Badge tone="warning">{label}</Badge>;
}

type AlertTone = "info" | "warning" | "danger" | "success";
export function Alert({ tone = "info", title, children }: { tone?: AlertTone; title?: string; children?: ReactNode }) {
  const styles: Record<AlertTone, string> = {
    info: "bg-info-bg text-navy-900 border-navy-100",
    warning: "bg-warning-bg text-warning border-warning/30",
    danger: "bg-danger-bg text-danger border-danger/30",
    success: "bg-success-bg text-success border-success/30",
  };
  const Icon = tone === "success" ? IconCheck : tone === "info" ? IconInfo : IconAlert;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl border p-4 text-sm", styles[tone])}>
      <Icon className="mt-0.5 shrink-0" />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-canvas px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="max-w-md text-sm text-muted">{children}</div> : null}
      {action}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-full rounded-full bg-lime-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="tabular mt-1 text-xl font-extrabold text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function DefinitionList({ items }: { items: { term: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.term}>
          <dt className="text-muted">{it.term}</dt>
          <dd className="font-medium text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
