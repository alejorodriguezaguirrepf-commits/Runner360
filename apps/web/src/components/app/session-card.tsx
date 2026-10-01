import Link from "next/link";
import { ChevronRight, Clock, Gauge, Ruler } from "lucide-react";
import {
  formatDate,
  formatDuration,
  formatKm,
  INTENSITY_LABELS,
  SESSION_TYPE_LABELS,
  WORKOUT_STATUS_LABELS,
} from "@runner360/shared";
import { Badge } from "@/components/ui/badge";
import type { CalendarItem } from "@/lib/data/training";
import { cn } from "@/components/ui/cn";

export function sessionStatus(item: CalendarItem, today: string) {
  if (item.log) {
    const tone = item.log.status === "completed" ? "success" : item.log.status === "modified" ? "lime" : "danger";
    return { label: WORKOUT_STATUS_LABELS[item.log.status], tone } as const;
  }
  if (item.session.type === "rest") return { label: "Descanso", tone: "neutral" } as const;
  if (item.scheduledDate < today) return { label: "Sin registrar", tone: "warning" } as const;
  if (item.scheduledDate === today) return { label: "Hoy", tone: "navy" } as const;
  return { label: "Pendiente", tone: "neutral" } as const;
}

export function SessionMeta({ item }: { item: CalendarItem }) {
  const s = item.session;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      {s.durationS ? (
        <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {formatDuration(s.durationS)}</li>
      ) : null}
      {s.distanceM ? (
        <li className="flex items-center gap-1.5"><Ruler className="size-4" aria-hidden /> {formatKm(s.distanceM)}</li>
      ) : null}
      <li className="flex items-center gap-1.5">
        <Gauge className="size-4" aria-hidden /> {INTENSITY_LABELS[s.intensity]}
        {s.rpeMin != null && s.rpeMax != null ? ` · RPE ${s.rpeMin}-${s.rpeMax}` : ""}
      </li>
    </ul>
  );
}

export function SessionRow({ item, today }: { item: CalendarItem; today: string }) {
  const st = sessionStatus(item, today);
  return (
    <Link
      href={`/app/plan/sesion/${item.id}`}
      className={cn(
        "flex items-center gap-4 rounded-xl border border-line bg-white p-4 hover:border-navy/30",
        item.scheduledDate === today && "border-navy ring-1 ring-navy",
      )}
    >
      <div className="w-14 shrink-0 text-center">
        <p className="text-xs font-medium uppercase text-muted">{formatDate(item.scheduledDate, { weekday: "short", day: undefined, month: undefined, year: undefined })}</p>
        <p className="tabular text-xl font-bold text-navy">{item.scheduledDate.slice(8, 10)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-navy">{item.session.title}</p>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <p className="text-xs text-muted">{SESSION_TYPE_LABELS[item.session.type]}</p>
        <div className="mt-1"><SessionMeta item={item} /></div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
