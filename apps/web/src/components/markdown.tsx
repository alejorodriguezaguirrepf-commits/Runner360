import type { ReactNode } from "react";

/**
 * Renderizador mínimo y seguro de Markdown (párrafos, listas, negrita, itálica).
 * No interpreta HTML: todo se renderiza como texto escapado por React.
 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**") ? <strong key={i++}>{tok.slice(2, -2)}</strong> : <em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-4 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length > 0 && lines.every((l) => /^\s*[-*] /.test(l))) {
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>)}
            </ul>
          );
        }
        if (/^#{1,3} /.test(b)) return <h2 key={i} className="text-lg font-bold">{inline(b.replace(/^#{1,3} /, ""))}</h2>;
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
