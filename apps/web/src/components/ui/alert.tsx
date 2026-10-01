import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "success" | "warning" | "danger";
const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "border-navy/15 bg-white text-navy", Icon: Info },
  success: { box: "border-success/30 bg-success-bg text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-bg text-warning", Icon: AlertTriangle },
  danger: { box: "border-danger/30 bg-danger-bg text-danger", Icon: XCircle },
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4 text-sm", box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink/90">{children}</div> : null}
      </div>
    </div>
  );
}
