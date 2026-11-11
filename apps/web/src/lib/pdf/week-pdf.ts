import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * PDF de una semana de entrenamiento (A4, para guardar o imprimir). Sin datos de salud: solo el plan,
 * los ritmos de referencia y lo registrado (km, tiempo, RPE). Se prueba en test/week-pdf.test.ts.
 */

export type WeekPdfLine = { what: string; effort: string | null; pace: string | null; notes: string[] };
export type WeekPdfBlock = { name: string; total: string | null; lines: WeekPdfLine[] };
export type WeekPdfDay = {
  /** "Lunes 9/11". */
  label: string;
  isRest: boolean;
  /** "Descanso" o "Solo fuerza" en los días sin carrera. */
  restLabel: string | null;
  title: string | null;
  /** "8,5 km · 50 min". */
  volume: string | null;
  blocks: WeekPdfBlock[];
  tips: string | null;
  strength: string | null;
  /** Lo registrado (si ya lo hizo): "8,5 km · 46:10 · RPE 6". */
  done: string | null;
  today: boolean;
};
export type WeekPdfData = {
  planTitle: string;
  planMeta: string;
  athlete: string | null;
  weekLabel: string;
  range: string;
  summary: string;
  goal: string | null;
  criterion: string | null;
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
  if (day.isRest) return rows;
  for (const b of day.blocks) {
    rows.push(...textRows(`${b.name.toUpperCase()}${b.total ? `  ·  ${b.total}` : ""}`, f, { bold: true, size: 7.5, color: TEAL_DARK, gap: 4 }));
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
  }
  if (day.strength) rows.push(...textRows(day.strength, f, { size: 8.5, gap: 5 }));
  if (day.tips) rows.push(...textRows(`Consejo: ${day.tips}`, f, { size: 8.5, color: MUTED, gap: 4 }));
  return rows;
}

const rowHeight = (r: Row) => r.size * 1.25 + r.gap;
const HEADER_H = 24;
const LOG_H = 28;

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
    ...(data.goal ? textRows(`Objetivo de la semana: ${data.goal}`, f, { size: 9.5, gap: 4 }) : []),
    ...(data.criterion ? textRows(`Para avanzar: ${data.criterion}`, f, { size: 9.5, gap: 2 }) : []),
    ...(data.paceNote ? textRows(data.paceNote, f, { size: 8.5, color: MUTED, gap: 4 }) : []),
  ];
  for (const r of intro) {
    y -= rowHeight(r);
    draw(r.text, M + r.indent, y, f[r.font], r.size, r.color);
  }
  y -= 14;

  for (const day of data.days) {
    const rows = dayRows(day, f);
    const body = rows.reduce((a, r) => a + rowHeight(r), 0);
    const total = HEADER_H + (day.isRest ? 0 : body + 8 + LOG_H) + 10;
    // Un día no se corta entre páginas salvo que no entre ni en una hoja nueva.
    if (total <= A4[1] - M * 2 - 40) ensure(total);
    else ensure(HEADER_H + 40);

    // Encabezado del día
    const top = y;
    page.drawRectangle({ x: M, y: top - HEADER_H, width: W, height: HEADER_H, color: day.isRest ? SOFT : day.today ? TEAL : SOFT, borderColor: LINE, borderWidth: 0.6 });
    const ink = NIGHT;
    draw(day.today ? `${day.label} · hoy` : day.label, M + 10, top - 16, f.bold, 10.5, ink);
    const title = day.isRest ? (day.restLabel ?? "Descanso") : (day.title ?? "Entrenamiento");
    draw(title, M + 130, top - 16, day.isRest ? f.regular : f.bold, 10.5, day.isRest ? MUTED : ink);
    if (day.volume && !day.isRest) {
      const v = clean(day.volume, f.bold);
      draw(v, M + W - 10 - f.bold.widthOfTextAtSize(v, 10.5), top - 16, f.bold, 10.5, ink);
    }
    y = top - HEADER_H;
    if (day.isRest) {
      y -= 10;
      continue;
    }

    y -= 4;
    for (const r of rows) {
      const h = rowHeight(r);
      if (y - h < M + 24) newPage();
      y -= h;
      draw(r.text, M + 10 + r.indent, y, f[r.font], r.size, r.color);
      if (r.suffix) draw(r.suffix, M + 10 + r.indent + f[r.font].widthOfTextAtSize(r.text, r.size) + 10, y, f.regular, 8.5, TEAL_DARK);
    }
    y -= 8;

    // Registro: lo hecho o espacios para completar a mano.
    if (y - LOG_H < M + 24) newPage();
    page.drawRectangle({ x: M, y: y - LOG_H + 4, width: W, height: LOG_H - 4, borderColor: LINE, borderWidth: 0.8, color: rgb(1, 1, 1) });
    const ly = y - LOG_H / 2 - 1;
    if (day.done) {
      draw("Hecho:", M + 10, ly, f.bold, 9.5, TEAL_DARK);
      draw(day.done, M + 50, ly, f.regular, 9.5);
    } else {
      page.drawRectangle({ x: M + 10, y: ly - 1.5, width: 10, height: 10, borderColor: NIGHT, borderWidth: 0.8 });
      draw("Hecho", M + 25, ly, f.regular, 9);
      const fields: [string, number][] = [["Km", 70], ["Tiempo", 80], ["RPE (1-10)", 40], ["Notas", 120]];
      let x = M + 70;
      for (const [label, width] of fields) {
        draw(label, x, ly, f.regular, 8.5, MUTED);
        const lw = f.regular.widthOfTextAtSize(label, 8.5) + 4;
        page.drawLine({ start: { x: x + lw, y: ly - 2 }, end: { x: x + lw + width - lw + 20, y: ly - 2 }, thickness: 0.6, color: LINE });
        x += width + 28;
      }
    }
    y -= LOG_H + 10;
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
