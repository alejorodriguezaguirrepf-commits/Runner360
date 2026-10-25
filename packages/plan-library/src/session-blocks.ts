/**
 * Partes de una sesión (entrada en calor, parte principal, vuelta a la calma) en líneas
 * estructuradas: qué hacer ("6 × 800 m"), intensidad (porcentaje de la velocidad del test),
 * recuperación ("Pausa 2 min trotando") y nota.
 *
 * Gramática del contenido desde la versión 2026.12 (la escribe scripts/rebuild-plans.ts):
 *   [TOTAL km: ]tramo + tramo + …
 *   tramo = qué[ al P %][ (aclaración)][, pausa … | , nota]
 *   p. ej. "15 min al 70 % + 5 min de movilidad + 4 × 100 m al 115 %, pausa 40 s"
 *          "4 × 1500 m al 90 %, pausa 2 min trotando"
 *          "15,5 km: 6,5 km al 70 % + 3 × 1000 m al 95 %, pausa 2 min trotando + 6 km al 70 %"
 * Un texto de una versión anterior (sin porcentajes) queda como una sola línea sin intensidad.
 */

export type SessionLine = {
  /** Distancia, repeticiones o tiempo: "6 × 800 m", "11 km", "15 min de movilidad". */
  what: string;
  /** Porcentaje de la velocidad del test, o null (movilidad, estiramientos o texto anterior). */
  pct: number | null;
  /** "Pausa 2 min trotando", "Vuelta caminando al punto de partida". */
  recovery: string | null;
  /** Aclaración: "Sin pausas", "Trote o caminata". */
  note: string | null;
};

export type BlockKind = "warmup" | "main" | "cooldown";

export type SessionBlock = {
  kind: BlockKind;
  /** Total de la parte principal cuando tiene varios tramos ("15,5 km"). */
  total: string | null;
  lines: SessionLine[];
  /** Porcentaje más alto del bloque, o null. */
  maxPct: number | null;
  /** Porcentaje que define el color: en la parte principal el más alto; en la entrada en calor y la
   * vuelta a la calma, el del primer tramo (los 100 m rápidos no cambian el carácter del bloque). */
  colorPct: number | null;
};

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const RECOVERY = /^(pausa|vuelta|recuperaci)/i;

/** Un tramo: "qué al P % (aclaración), pausa …". */
export function parseSegment(raw: string): SessionLine {
  const s = raw.trim();
  const m = /^(?<what>.+?) al (?<pct>\d{2,3}) %(?: \((?<paren>[^)]*)\))?(?:, (?<tail>.+))?$/.exec(s);
  const plain = m ? null : /^(?<what>[^,(]+?)(?: \((?<paren>[^)]*)\))?(?:, (?<tail>.+))?$/.exec(s);
  const g = (m ?? plain)?.groups;
  if (!g) return { what: cap(s), pct: null, recovery: null, note: null };
  let recovery: string | null = null;
  let note: string | null = null;
  for (const extra of [g.paren, g.tail]) {
    if (!extra) continue;
    if (RECOVERY.test(extra)) recovery = cap(extra);
    else note = note ? `${note}. ${cap(extra)}` : cap(extra);
  }
  return { what: cap(g.what!), pct: m ? Number(g.pct) : null, recovery, note };
}

/** Un bloque de la sesión. Sin porcentajes (contenido anterior): una sola línea con el texto. */
export function parseBlock(text: string | null | undefined, kind: BlockKind): SessionBlock {
  const t = (text ?? "").trim();
  if (!t) return { kind, total: null, lines: [], maxPct: null, colorPct: null };
  if (!/\bal \d{2,3} %/.test(t)) return { kind, total: null, lines: [{ what: t, pct: null, recovery: null, note: null }], maxPct: null, colorPct: null };
  const header = /^(?<total>\d+(?:,\d+)? km): (?<rest>.+)$/.exec(t);
  const body = header ? header.groups!.rest! : t;
  const lines = body.split(" + ").map(parseSegment);
  const pcts = lines.map((l) => l.pct).filter((p): p is number => p !== null);
  const maxPct = pcts.length ? Math.max(...pcts) : null;
  return { kind, total: header ? header.groups!.total! : null, lines, maxPct, colorPct: kind === "main" ? maxPct : (pcts[0] ?? null) };
}

/** Los tres bloques de una sesión. */
export function sessionBlocks(day: { warmup: string | null; main_set: string | null; cooldown: string | null }): SessionBlock[] {
  return [parseBlock(day.warmup, "warmup"), parseBlock(day.main_set, "main"), parseBlock(day.cooldown, "cooldown")];
}

/** Tramo de movimiento (correr o caminar) que debería tener porcentaje. Movilidad y estiramientos no. */
export function needsIntensity(line: SessionLine): boolean {
  return !/movilidad|estiramientos|técnica/i.test(line.what);
}
