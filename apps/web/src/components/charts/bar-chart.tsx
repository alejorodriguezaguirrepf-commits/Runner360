"use client";
import { useId, useState } from "react";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Texto del tooltip y de la tabla (valor ya formateado). */
  display: string;
}

/**
 * Gráfico de barras de una sola serie (sin leyenda: el título la nombra).
 * Barras finas con extremo redondeado anclado a la base, grilla tenue, tooltip por barra
 * (hover y foco de teclado) y tabla equivalente para lectores de pantalla.
 */
export function BarChart({ title, data, unitLabel, height = 180 }: { title: string; data: BarDatum[]; unitLabel: string; height?: number }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length);
  const W = 100 * n;
  const barW = Math.min(36, 100 * 0.5);
  const top = 16;
  const plotH = height - top - 24;
  const ticks = [0, 0.5, 1];

  if (data.length === 0) return <p className="text-sm text-muted">Sin datos para mostrar.</p>;

  return (
    <figure aria-labelledby={`${id}-t`} className="relative">
      <figcaption id={`${id}-t`} className="sr-only">{title}</figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="h-[180px] w-full overflow-visible" role="img" aria-label={`${title}. Ver tabla de datos debajo.`}>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke="currentColor" className="text-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(4, (d.value / max) * plotH) : 0;
            const x = i * 100 + (100 - barW) / 2;
            const y = top + plotH - h;
            const r = Math.min(4, h);
            return (
              <g key={d.key}>
                {/* Zona de interacción más grande que la barra */}
                <rect x={i * 100} y={top} width={100} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
                {h > 0 ? (
                  <path
                    d={`M${x},${top + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${top + plotH} Z`}
                    className={active === i ? "fill-navy" : "fill-navy-600"}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
        {active != null ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-navy px-2.5 py-1.5 text-xs text-white shadow"
            style={{ left: `${((active + 0.5) / n) * 100}%` }}
          >
            <span className="font-semibold">{data[active]!.label}</span> · {data[active]!.display}
          </div>
        ) : null}
        <div className="mt-1 grid text-center text-[11px] text-muted" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              className="whitespace-nowrap rounded px-0.5 py-1 hover:text-navy focus-visible:text-navy"
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              aria-label={`${d.label}: ${d.display}`}
            >
              {(n - 1 - i) % Math.ceil(n / 5) === 0 ? d.label : "\u00a0"}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-navy-600">Ver datos en tabla</summary>
        <table className="tabular mt-2 w-full text-left text-xs">
          <thead className="text-muted"><tr><th scope="col" className="py-1">Período</th><th scope="col" className="py-1">{unitLabel}</th></tr></thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-line"><td className="py-1">{d.label}</td><td className="py-1">{d.display}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
