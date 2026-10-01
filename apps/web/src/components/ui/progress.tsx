export function ProgressBar({ value, label, max = 1 }: { value: number; label: string; max?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-2.5 w-full overflow-hidden rounded-full bg-navy/10"
      >
        <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
