import "server-only";
import { planDayAt } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import { annualAccessUntil, hasPremium, type Session } from "@/lib/auth";
import { enrollmentOver, getOpenEnrollment } from "@/lib/data/enrollment";
import { todaySummary } from "@/lib/library/week";
import { logError } from "@/lib/log";
import type { RunnieContext } from "./prompt";

/** Datos de la cuenta que Runnie usa para responder sobre el caso de la persona. Nunca falla: sin datos, va sin plan. */
export async function runnieContext(session: Session, remaining: number): Promise<RunnieContext> {
  const { supabase, user, profile } = session;
  const today = todayIn(profile.timezone);
  const [premium, annualUntil] = await Promise.all([hasPremium(session), annualAccessUntil(session)]);
  const base: RunnieContext = { name: profile.display_name, today, premium, annual: Boolean(annualUntil), remaining, plan: null };
  try {
    const open = await getOpenEnrollment(supabase, user.id);
    if (!open || enrollmentOver(open, today)) return base;
    const { enrollment, plan } = open;
    const [{ data: openWeeks }, todayText] = await Promise.all([
      supabase.rpc("enrollment_open_weeks", { p_enrollment: enrollment.id }),
      todaySummary(supabase, open, today).catch(() => ""),
    ]);
    const slot = planDayAt(enrollment, open.segments, plan.duration_weeks, today);
    return {
      ...base,
      plan: {
        title: plan.title,
        distance: plan.distance_label,
        level: plan.level,
        duration: plan.duration_label,
        daysPerWeek: plan.days_per_week,
        startDate: enrollment.start_date,
        raceDate: enrollment.race_date,
        status: enrollment.status,
        currentWeek: slot?.planWeek ?? null,
        totalWeeks: plan.duration_weeks,
        openWeeks: typeof openWeeks === "number" ? openWeeks : 0,
        today: todayText || null,
      },
    };
  } catch (e) {
    logError("runnie:context", e);
    return base;
  }
}
