import Link from "next/link";
import { cn } from "./ui/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#122438" />
      <path d="M8 21.5c3.5-1 6-3.6 7.6-7.6l1.1-2.9" stroke="#D5F36A" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="21.5" cy="10" r="3" fill="#D5F36A" />
      <path d="M15 21.5h9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2" aria-label="RUNNER 360, inicio">
      <LogoMark />
      <span className={cn("text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-navy")}>
        RUNNER <span className={dark ? "text-lime" : "text-navy-600"}>360</span>
      </span>
    </Link>
  );
}
