import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * PDF de una semana de entrenamiento (A4, para guardar o imprimir): los días de entrenamiento tal como
 * se ven en Mi plan (Día 1, Día 2…), sin descansos ni días de solo fuerza. Sin datos de salud. Se prueba
 * en test/week-pdf.test.ts.
 */

export type WeekPdfLine = { what: string; effort: string | null; pace: string | null; notes: string[] };
export type WeekPdfBlock = { name: string; total: string | null; lines: WeekPdfLine[] };
export type WeekPdfDay = {
  /** "Día 1" (como en la pantalla del plan). */
  label: string;
  /** "10 nov". */
  dateHint: string;
  /** "9,9 km · 59'". */
  volume: string;
  blocks: WeekPdfBlock[];
  /** "Después: Rutina de fuerza". */
  strength: string | null;
  done: boolean;
  today: boolean;
};
export type WeekPdfData = {
  planTitle: string;
  planMeta: string;
  athlete: string | null;
  weekLabel: string;
  range: string;
  summary: string;
  paceNote: string | null;
  days: WeekPdfDay[];
  rpeNote: string;
  generatedAt: string;
};

const A4: [number, number] = [595.28, 841.89];
const M = 40;
const W = A4[0] - M * 2;
const NIGHT = rgb(16 / 255, 28 / 255, 44 / 255);
const TEAL = rgb(24 / 255, 169 / 255, 153 / 255);
const TEAL_DARK = rgb(10 / 255, 114 / 255, 102 / 255);
const MUTED = rgb(0.36, 0.42, 0.5);
const LINE = rgb(0.85, 0.88, 0.91);
const SOFT = rgb(0.95, 0.97, 0.98);

/** Reemplaza lo que las fuentes estándar del PDF no pueden escribir. */
function clean(text: string, font: PDFFont): string {
  const map: Record<string, string> = { "\u2192": "->", "\u2248": "~", "\u2264": "<=", "\u2265": ">=", "\u2032": "'", "\u2033": '"', "\u2011": "-", "\u2212": "-", "\u00a0": " ", "\u202f": " " };
  const allowed = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.replace(/\s+/g, " ")) {
    const c = map[ch] ?? ch;
    for (const x of c) out += allowed.has(x.codePointAt(0)!) ? x : "";
  }
  return out.trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text, font).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Una línea de texto ya cortada, con su estilo. */
type Row = { text: string; font: "regular" | "bold"; size: number; color: ReturnType<typeof rgb>; indent: number; gap: number; suffix?: string };

function textRows(text: string, f: Fonts, opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number }): Row[] {
  const font = opts.bold ? "bold" : "regular";
  const size = opts.size ?? 9.5;
  const indent = opts.indent ?? 0;
  return wrap(text, f[font], size, W - 20 - indent).map((t, i) => ({ text: t, font, size, color: opts.color ?? NIGHT, indent, gap: i === 0 ? (opts.gap ?? 0) : 0 }));
}

function dayRows(day: WeekPdfDay, f: Fonts): Row[] {
  const rows: Row[] = [];
  day.blocks.forEach((b, i) => {
    rows.push(...textRows(`${i + 1}. ${b.name.toUpperCase()}${b.total ? `  ·  ${b.total}` : ""}`, f, { bold: true, size: 7.5, color: TEAL_DARK, gap: 4 }));
    for (const l of b.lines) {
      const what = textRows(l.what, f, { bold: true, size: 9.5, indent: 8, gap: 1.5 });
      const meta = clean([l.effort, l.pace].filter(Boolean).join(" · "), f.regular);
      const last = what.at(-1);
      // El porcentaje, el RPE y el ritmo van en la misma línea si entran; si no, debajo.
      if (meta && last && f.bold.widthOfTextAtSize(last.text, 9.5) + f.regular.widthOfTextAtSize(`   ${meta}`, 8.5) <= W - 20 - 8) last.suffix = meta;
      rows.push(...what);
      if (meta && !last?.suffix) rows.push(...textRows(meta, f, { size: 8.5, color: TEAL_DARK, indent: 8 }));
      for (const n of l.notes) rows.push(...textRows(n, f, { size: 8.5, color: MUTED, indent: 8 }));
    }
  });
  if (day.strength) rows.push(...textRows(day.strength, f, { size: 8.5, gap: 5 }));
  return rows;
}

const rowHeight = (r: Row) => r.size * 1.25 + r.gap;
const HEADER_H = 26;

export async function buildWeekPdf(data: WeekPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${data.planTitle} - ${data.weekLabel}`);
  doc.setAuthor("RUNNER 360");
  doc.setCreator("RUNNER 360");
  doc.setLanguage("es-AR");
  const f: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;

  const draw = (text: string, x: number, yy: number, font: PDFFont, size: number, color = NIGHT) =>
    page.drawText(clean(text, font), { x, y: yy, font, size, color });
  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - M;
    draw(`${data.planTitle} · ${data.weekLabel}`, M, y - 8, f.bold, 9, MUTED);
    y -= 24;
  };
  const ensure = (h: number) => {
    if (y - h < M + 24) newPage();
  };

  // Encabezado
  page.drawRectangle({ x: 0, y: A4[1] - 96, width: A4[0], height: 96, color: NIGHT });
  draw("RUNNER 360", M, A4[1] - 34, f.bold, 11, TEAL);
  draw(data.planTitle, M, A4[1] - 56, f.bold, 18, rgb(1, 1, 1));
  draw(`${data.weekLabel}  ·  ${data.range}`, M, A4[1] - 76, f.regular, 10.5, rgb(0.85, 0.9, 0.95));
  if (data.athlete) {
    const t = clean(data.athlete, f.regular);
    draw(t, A4[0] - M - f.regular.widthOfTextAtSize(t, 10), A4[1] - 34, f.regular, 10, rgb(0.85, 0.9, 0.95));
  }
  y = A4[1] - 96 - 20;

  // Resumen de la semana
  const intro: Row[] = [
    ...textRows(data.planMeta, f, { size: 9, color: MUTED }),
    ...textRows(data.summary, f, { bold: true, size: 11, gap: 4 }),
    ...(data.paceNote ? textRows(data.paceNote, f, { size: 8.5, color: MUTED, gap: 4 }) : []),
  ];
  for (const r of intro) {
    y -= rowHeight(r);
    draw(r.text, M + r.indent, y, f[r.font], r.size, r.color);
  }
  y -= 14;

  for (const day of data.days) {
    const rows = dayRows(day, f);
    const total = HEADER_H + rows.reduce((a, r) => a + rowHeight(r), 0) + 22;
    // Un día no se corta entre páginas salvo que no entre ni en una hoja nueva.
    if (total <= A4[1] - M * 2 - 40) ensure(total);
    else ensure(HEADER_H + 40);

    // Encabezado del día, como en la app: "Día 1", km y duración, fecha y si ya está hecho.
    const top = y;
    page.drawRectangle({ x: M, y: top - HEADER_H, width: W, height: HEADER_H, color: day.today ? TEAL : SOFT, borderColor: LINE, borderWidth: 0.6 });
    draw(day.label, M + 10, top - 17, f.bold, 11.5);
    const labelW = f.bold.widthOfTextAtSize(clean(day.label, f.bold), 11.5);
    draw(day.volume, M + 22 + labelW, top - 17, f.bold, 11.5);
    const right = clean([day.dateHint, day.today ? "hoy" : null, day.done ? "Hecho" : null].filter(Boolean).join(" · "), f.regular);
    draw(right, M + W - 10 - f.regular.widthOfTextAtSize(right, 9.5), top - 16.5, day.done ? f.bold : f.regular, 9.5, day.today ? NIGHT : day.done ? TEAL_DARK : MUTED);
    y = top - HEADER_H - 4;

    for (const r of rows) {
      const h = rowHeight(r);
      if (y - h < M + 24) newPage();
      y -= h;
      draw(r.text, M + 10 + r.indent, y, f[r.font], r.size, r.color);
      if (r.suffix) draw(r.suffix, M + 10 + r.indent + f[r.font].widthOfTextAtSize(r.text, r.size) + 10, y, f.regular, 8.5, TEAL_DARK);
    }
    y -= 18;
  }

  // Escala de esfuerzo al final
  const notes = textRows(data.rpeNote, f, { size: 8, color: MUTED });
  ensure(notes.reduce((a, r) => a + rowHeight(r), 0) + 10);
  for (const r of notes) {
    y -= rowHeight(r);
    draw(r.text, M, y, f[r.font], r.size, r.color);
  }

  // Pie en todas las páginas
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const text = clean(`RUNNER 360 · runner360.ar · Generado el ${data.generatedAt} · Página ${i + 1} de ${pages.length}`, f.regular);
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: A4[0] - M, y: M - 6 }, thickness: 0.5, color: LINE });
    p.drawText(text, { x: M, y: M - 18, font: f.regular, size: 7.5, color: MUTED });
  });

  return doc.save();
}
