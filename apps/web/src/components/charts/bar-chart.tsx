"use client";

import { useState } from "react";

export interface BarDatum {
  key: string;
  /** Etiqueta corta del eje X. */
  label: string;
  value: number;
  /** Texto del valor ya formateado (tooltip, tabla). */
  display: string;
  highlight?: boolean;
}

/**
 * Gráfico de barras de una sola serie, accesible:
 *  - Barras finas en azul marino (contraste > 3:1 sobre blanco), extremo superior redondeado de 4px.
 *  - Grilla recesiva, una sola escala, tooltip al pasar el cursor o enfocar con teclado.
 *  - Tabla equivalente disponible para lectores de pantalla y consulta de valores.
 */
export function BarChart({ title, data, unitLabel }: { title: string; data: BarDatum[]; unitLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 200;
  const pad = { top: 16, right: 8, bottom: 28, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / Math.max(1, data.length);
  const barW = Math.min(28, slot * 0.6);
  const gridValues = [0.5, 1].map((f) => f * max);
  const activeDatum = active !== null ? data[active] : undefined;

  return (
    <figure className="space-y-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${title}. Ver tabla de datos debajo.`}>
          {gridValues.map((g) => {
            const y = pad.top + plotH - (g / max) * plotH;
            return <line key={g} x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#dfe5ec" strokeWidth={1} />;
          })}
          <line x1={pad.left} x2={W - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#b9c4d0" strokeWidth={1} />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * plotH) : 0;
            const x = pad.left + i * slot + (slot - barW) / 2;
            const y = pad.top + plotH - h;
            const r = Math.min(4, h / 2, barW / 2);
            const path = h > 0 ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z` : "";
            return (
              <g
                key={d.key}
                tabIndex={0}
                role="button"
                aria-label={`${d.label}: ${d.display}`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill={active === i ? "#eef4fb" : "transparent"} />
                {path ? <path d={path} fill={d.highlight ? "#122438" : "#26446a"} opacity={active === null || active === i ? 1 : 0.55} /> : null}
                {i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
                  <text x={pad.left + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#55657a">
                    {d.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {activeDatum && active !== null ? (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow"
            style={{ left: `${((pad.left + active * slot + slot / 2) / W) * 100}%` }}
          >
            {activeDatum.label}: {activeDatum.display}
          </div>
        ) : null}
      </div>
      <figcaption className="text-xs text-muted">
        {title} ({unitLabel}).{" "}
        <details className="inline">
          <summary className="inline cursor-pointer font-semibold text-navy-700">Ver datos</summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead><tr><th className="py-1 pr-4">Período</th><th className="py-1">Valor</th></tr></thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line"><td className="py-1 pr-4">{d.label}</td><td className="tabular py-1">{d.display}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      </figcaption>
    </figure>
  );
}
