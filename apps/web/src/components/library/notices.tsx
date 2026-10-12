import { IconInfo, IconShield } from "@/components/ui/icons";
import { t } from "@/i18n";
import type { Intensity } from "@runner360/plan-library";

const m = t.library;

/** Aclaración obligatoria: los valores son estimados para un corredor modelo (texto del contenido). */
export function EstimateNotice({ note }: { note: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-navy-100 bg-info-bg p-3 text-sm text-navy-900">
      <IconInfo className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">{m.estimate.title}. </span>
        {note} {m.estimate.text}
      </p>
    </div>
  );
}

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

/** Escala de intensidad (RPE y prueba del habla), a un toque desde cualquier sesión. */
export function IntensityScale({ items, defaultOpen = false }: { items: Intensity[]; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-xl border border-line bg-surface p-3 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-ink">{m.intensity.title}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 pr-3">{m.day.intensity}</th>
              <th scope="col" className="py-1 pr-3">{m.intensity.zone}</th>
              <th scope="col" className="py-1 pr-3">{m.intensity.rpe}</th>
              <th scope="col" className="py-1 pr-3">{m.intensity.talk}</th>
              <th scope="col" className="py-1 pr-3">{m.intensity.feel}</th>
              <th scope="col" className="py-1">{m.intensity.use}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((i) => (
              <tr key={i.name}>
                <th scope="row" className="py-1.5 pr-3 font-semibold">{i.name}</th>
                <td className="py-1.5 pr-3">{i.zone}</td>
                <td className="py-1.5 pr-3 tabular">{i.rpe}</td>
                <td className="py-1.5 pr-3">{i.talk_test}</td>
                <td className="py-1.5 pr-3">{i.feel}</td>
                <td className="py-1.5">{i.use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
