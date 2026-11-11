import { mondayOf, weekdayOf } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import { NextResponse } from "next/server";
import { fmt, t } from "@/i18n";
import { getSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { planPaces } from "@/lib/data/paces";
import { loadWeek } from "@/lib/library/week";
import { logError } from "@/lib/log";
import { weekPdfData } from "@/lib/pdf/week-data";
import { buildWeekPdf } from "@/lib/pdf/week-pdf";

/**
 * PDF de una semana del plan en curso (?semana=AAAA-MM-DD, el lunes; por defecto la actual).
 * Solo semanas que la persona puede ver en la app (las mismas reglas de acceso del plan).
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/ingresar?next=/plan", request.url));
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) return new NextResponse("No tenés un plan en curso.", { status: 404 });

  const requested = new URL(request.url).searchParams.get("semana");
  const weekStart = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && weekdayOf(requested) === 0 ? requested : mondayOf(today);
  const [week, paces] = await Promise.all([
    loadWeek(supabase, open, weekStart),
    planPaces(supabase, user.id, open.library.version.model_runner_assumptions, open.plan.chapter, today),
  ]);
  if (!week || week.dated.length !== 7) return new NextResponse("Esta semana no está disponible.", { status: 403 });

  try {
    const generatedAt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: profile.timezone || "America/Argentina/Buenos_Aires" }).format(new Date());
    const pdf = await buildWeekPdf(
      weekPdfData({
        planTitle: open.plan.title,
        planMeta: `${open.plan.distance_label} · ${open.plan.level} · ${open.plan.duration_label} · ${fmt(t.library.catalog.days, { n: open.plan.days_per_week })}`,
        athlete: profile.display_name ?? null,
        planWeek: week.planWeek,
        totalWeeks: open.plan.duration_weeks,
        dated: week.dated,
        logs: week.logs,
        test: paces.test,
        testDate: paces.testDate,
        speeds: paces.speeds,
        today,
        generatedAt,
      }),
    );
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="runner360-semana-${week.planWeek}-${weekStart}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    logError("plan:pdf", e);
    return new NextResponse("No pudimos generar el PDF. Probá nuevamente.", { status: 500 });
  }
}
