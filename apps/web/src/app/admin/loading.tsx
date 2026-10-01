export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-navy/10" />
      <div className="h-40 rounded-[var(--radius-card)] bg-navy/10" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-navy/10" />)}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
