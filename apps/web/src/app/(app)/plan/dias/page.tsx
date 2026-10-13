import { isDemandingShape, type DayShape } from "@runner360/plan-library";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconChevronLeft } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/primitives";
import { t } from "@/i18n";
import { requireOnboardedSession } from "@/lib/auth";
import { getOpenEnrollment } from "@/lib/data/enrollment";
import { getOverviewDays } from "@/lib/data/library";
import { MoveDaysForm, type PlanDayInfo } from "./move-days-form";

export const metadata: Metadata = { title: "Mover días" };

export default async function MoveDaysPage() {
  const { supabase, user } = await requireOnboardedSession();
  const open = await getOpenEnrollment(supabase, user.id);
  if (!open) redirect("/plan");
  const overview = await getOverviewDays(supabase, open.enrollment.content_version, open.plan.id);
  const shapes: DayShape[] = overview.map((d) => ({ week: d.week, day_index: d.day_index, is_rest: d.is_rest, category: d.category, is_quality: d.is_quality }));
  // Cada día del plan con un ejemplo (la primera semana visible) y si alguna vez es exigente.
  const days: PlanDayInfo[] = Array.from({ length: 7 }, (_, i) => {
    const sample = overview.find((d) => d.day_index === i);
    return {
      dayIndex: i,
      label: sample ? (sample.is_rest ? (sample.strength_only ? t.library.day.strengthOnly : t.library.day.rest) : (sample.short_label ?? "")) : "",
      demanding: shapes.some((s) => s.day_index === i && isDemandingShape(s)),
    };
  });
  return (
    <>
      <Link href="/plan" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <IconChevronLeft width={16} height={16} /> {open.plan.title}
      </Link>
      <PageHeader title={t.library.moveDays.title} subtitle={t.library.moveDays.subtitle} />
      <MoveDaysForm initial={open.enrollment.day_map} days={days} shapes={shapes} />
    </>
  );
}
