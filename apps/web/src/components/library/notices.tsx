import { IconShield } from "@/components/ui/icons";
import { t } from "@/i18n";
import { rpeTable } from "@runner360/plan-library";

const m = t.library;

/** Avisos de seguridad del contenido, visibles desde cualquier plan. */
export function SafetyNotices({ items, defaultOpen = false }: { items: string[]; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-warning/30 bg-warning-bg p-3 text-sm text-warning">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold">
        <IconShield className="shrink-0" />
        {m.safety.title} · <span className="underline">{m.safety.open}</span>
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </details>
  );
}

/** Escala de intensidad: porcentaje del ritmo del test y su RPE (la misma tabla de cada sesión). */
export function IntensityScale({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const w = t.library.workout;
  return (
    <details open={defaultOpen} className="rounded-xl border border-line bg-surface p-3 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-ink">{w.rpeTable}</summary>
      <p className="mt-2">{w.rpeText}</p>
      <table className="mt-2 w-full text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th scope="col" className="py-1 pr-3">%</th>
            <th scope="col" className="py-1">RPE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rpeTable().map((r) => (
            <tr key={r.range}>
              <th scope="row" className="py-1.5 pr-3 font-medium tabular">{r.range}</th>
              <td className="py-1.5 font-semibold tabular">{r.rpe}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
