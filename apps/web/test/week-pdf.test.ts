import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DayRow } from "@/lib/data/library";
import { rangeLabel, weekPdfData } from "@/lib/pdf/week-data";
import { buildWeekPdf } from "@/lib/pdf/week-pdf";

type JsonDay = Record<string, unknown> & { day_index: number; is_rest: boolean };
type JsonPlan = { id: string; title: string; distance: string; level: string; duration_label: string; duration_weeks: number; weeks: { week: number; weekly_goal: string; progression_criterion: string; days: JsonDay[] }[] };
const library = JSON.parse(readFileSync(join(__dirname, "../../../content/training-plans/running_plans_library.json"), "utf8")) as { plans: JsonPlan[] };

function toDay(week: number, d: JsonDay): DayRow {
  return {
    week,
    day_index: d.day_index,
    day_label: String(d.day ?? ""),
    is_rest: d.is_rest,
    strength_only: Boolean(d.strength_only),
    code: (d.code as string) ?? null,
    session_type: (d.type as string) ?? null,
    category: (d.category as DayRow["category"]) ?? null,
    short_label: (d.short_label as string) ?? null,
    physiological_goal: (d.physiological_goal as string) ?? null,
    warmup: (d.warmup as string) ?? null,
    main_set: (d.main_set as string) ?? null,
    cooldown: (d.cooldown as string) ?? null,
    duration_min_est: (d.duration_min_est as number) ?? null,
    distance_km_est: (d.distance_km_est as number) ?? null,
    intensity: (d.intensity as string) ?? null,
    technical_notes: (d.technical_notes as string) ?? null,
    strength_after: (d.strength_after as boolean) ?? null,
    is_quality: (d.is_quality as boolean) ?? null,
    minutes_by_intensity: null,
  };
}

async function pdfFor(plan: JsonPlan, weekNumber: number, withTest: boolean) {
  const week = plan.weeks.find((w) => w.week === weekNumber)!;
  const monday = "2026-11-09";
  const dated = week.days.map((d) => ({ day: toDay(week.week, d), date: `2026-11-${String(9 + d.day_index).padStart(2, "0")}` }));
  const firstRun = dated.find((x) => !x.day.is_rest)!;
  const data = weekPdfData({
    planTitle: plan.title,
    planMeta: `${plan.distance} · ${plan.level} · ${plan.duration_label}`,
    athlete: "Corredora de prueba",
    planWeek: week.week,
    totalWeeks: plan.duration_weeks,
    week: { weekly_goal: week.weekly_goal, progression_criterion: week.progression_criterion } as never,
    dated,
    logs: [{ workout_date: firstRun.date, status: "completed", distance_m: 8500, duration_s: 2770, rpe: 6 }],
    test: withTest ? { meters: 5000, seconds: 1500 } : null,
    testDate: withTest ? "2026-10-20" : null,
    speeds: null,
    today: "2026-11-11",
    generatedAt: "11/11/26 10:30",
  });
  expect(monday).toBe(dated[0]!.date);
  return { data, bytes: await buildWeekPdf(data) };
}

describe("PDF de la semana", () => {
  it("fechas de la semana en palabras", () => {
    expect(rangeLabel("2026-11-09", "2026-11-15")).toBe("9 al 15 de noviembre de 2026");
    expect(rangeLabel("2026-10-26", "2026-11-01")).toBe("26 de octubre al 1 de noviembre de 2026");
    expect(rangeLabel("2026-12-28", "2027-01-03")).toBe("28 de diciembre de 2026 al 3 de enero de 2027");
  });

  it("arma los 7 días con lo hecho, ritmos y espacios para completar", async () => {
    const { data, bytes } = await pdfFor(library.plans[0]!, 3, true);
    expect(data.days).toHaveLength(7);
    expect(data.weekLabel).toMatch(/^Semana 3 de \d+$/);
    expect(data.days.filter((d) => d.done)).toHaveLength(1);
    expect(data.days.find((d) => !d.isRest)!.blocks.some((b) => b.lines.some((l) => l.pace?.startsWith("Ritmo ")))).toBe(true);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain("Semana 3");
    if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, "semana-corta.pdf"), bytes);
  });

  it("una semana larga de maratón entra en varias hojas sin errores", async () => {
    const plan = [...library.plans].sort((a, b) => b.duration_weeks - a.duration_weeks)[0]!;
    const busiest = [...plan.weeks].sort((a, b) => b.days.filter((d) => !d.is_rest).length - a.days.filter((d) => !d.is_rest).length)[0]!;
    const { bytes } = await pdfFor(plan, busiest.week, false);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, "semana-larga.pdf"), bytes);
  });
});
