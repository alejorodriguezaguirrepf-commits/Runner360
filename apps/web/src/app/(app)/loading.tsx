export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-navy-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-navy-100" />
      <div className="h-24 animate-pulse rounded-2xl bg-navy-100" />
    </div>
  );
}
