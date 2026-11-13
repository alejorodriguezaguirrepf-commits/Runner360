import "server-only";
import { formatClock, mondayOf, planDayAt } from "@runner360/plan-library";
import { todayIn } from "@runner360/shared";
import { annualAccessUntil, hasPremium, type Session } from "@/lib/auth";
import { enrollmentOver, getOpenEnrollment } from "@/lib/data/enrollment";
import { hasHealthConsent, loadMonitoring } from "@/lib/data/monitoring";
import { planPaces } from "@/lib/data/paces";
import { strengthForDay } from "@/lib/library/strength";
import { loadWeek, todaySummary } from "@/lib/library/week";
import { logError } from "@/lib/log";
import { acuteChronic, addDaysIso, loadStatus } from "@/lib/monitoring";
import { averageScore } from "@/lib/wellness";
import { loadLine, recentSessionLine, sessionLines, strengthLine, testLine, wellnessLine } from "./facts";
import type { RunnieContext } from "./prompt";

type Plan = NonNullable<RunnieContext["plan"]>;

/**
 * Datos de la cuenta que Runnie usa para responder sobre el caso de la persona. Nunca falla: sin
 * datos, va sin plan. El wellness y las sesiones (datos de salud) van solo si la persona eligió
 * compartirlos en el chat y dio su consentimiento para registrarlos.
 */
export async function runnieContext(session: Session, remaining: number, shareHealth = false): Promise<RunnieContext> {
  const { profile } = session;
  const today = todayIn(profile.timezone);
  const [premium, annualUntil] = await Promise.all([hasPremium(session), annualAccessUntil(session)]);
  const base: RunnieContext = { name: profile.display_name, today, premium, annual: Boolean(annualUntil), remaining, plan: null };
  const [plan, health] = await Promise.all([planContext(session, today), shareHealth ? healthContext(session, today) : Promise.resolve(null)]);
  return { ...base, plan, health };
}

async function planContext(session: Session, today: string): Promise<Plan | null> {
  const { supabase, user } = session;
  try {
    const open = await getOpenEnrollment(supabase, user.id);
    if (!open || enrollmentOver(open, today)) return null;
    const { enrollment, plan, library } = open;
    const slot = planDayAt(enrollment, open.segments, plan.duration_weeks, today);
    const [{ data: openWeeks }, todayText, paces, week] = await Promise.all([
      supabase.rpc("enrollment_open_weeks", { p_enrollment: enrollment.id }),
      todaySummary(supabase, open, today).catch(() => ""),
      planPaces(supabase, user.id, library.version.model_runner_assumptions, plan.chapter, today).catch(() => null),
      slot && enrollment.status !== "paused" ? loadWeek(supabase, open, mondayOf(today)).catch(() => null) : Promise.resolve(null),
    ]);
    const day = slot && week ? (week.days.find((d) => d.day_index === slot.dayIndex) ?? null) : null;
    const strength =
      slot && week
        ? strengthForDay({ exercises: library.strength, routine: plan.strength_routine, days: week.days, week: week.week, totalWeeks: plan.duration_weeks }, slot.dayIndex)
        : null;
    const log = week?.logs.find((l) => l.workout_date === today && l.status !== "skipped") ?? null;
    const saved = log
      ? [
          log.distance_m ? `${(log.distance_m / 1000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} km` : null,
          log.duration_s ? `en ${formatClock(log.duration_s)}` : null,
          log.rpe ? `RPE ${log.rpe}` : null,
        ]
          .filter(Boolean)
          .join(", ") || "sí"
      : null;
    return {
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
      test: paces?.test && paces.testDate ? testLine(paces.test, paces.testDate) : null,
      session: day && !day.is_rest ? sessionLines(day, paces?.test ?? null) : null,
      strength: strength ? strengthLine(strength) : null,
      saved,
    };
  } catch (e) {
    logError("runnie:context", e);
    return null;
  }
}

/** undefined si no dio el consentimiento de datos de salud (o si falla la lectura): no se menciona. */
async function healthContext(session: Session, today: string): Promise<NonNullable<RunnieContext["health"]> | undefined> {
  const { supabase, user } = session;
  try {
    if (!(await hasHealthConsent(supabase, user.id))) return undefined;
    const { wellness, sessions } = await loadMonitoring(supabase, user.id, addDaysIso(today, -28));
    const todayRow = wellness.find((w) => w.check_date === today) ?? null;
    const week = wellness.filter((w) => w.check_date > addDaysIso(today, -7));
    const ac = acuteChronic(sessions, today);
    return {
      wellnessToday: todayRow ? wellnessLine(todayRow) : null,
      wellnessWeek: averageScore(week),
      recent: sessions.slice(0, 6).map(recentSessionLine),
      load: sessions.length ? loadLine(ac.acute, ac.chronic, loadStatus(ac.ratio)) : null,
    };
  } catch (e) {
    logError("runnie:health-context", e);
    return undefined;
  }
}
