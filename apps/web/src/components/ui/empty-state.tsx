import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface">
        <Icon className="size-6 text-navy" aria-hidden />
      </span>
      <h2 className="mt-4 text-base font-semibold text-navy">{title}</h2>
      {children ? <div className="mt-1 max-w-md text-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
