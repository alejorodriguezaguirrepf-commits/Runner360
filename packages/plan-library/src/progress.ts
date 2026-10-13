import { addDays, mondayOf } from "./dates";
import type { ScheduledWeek } from "./schedule";

/**
 * Progreso de una inscripción: planificado (contenido) contra real (registros), por semana de
 * calendario. Las zonas "realizadas" salen de los minutos por intensidad que el CONTENIDO asigna a
 * las sesiones que la persona completó (no se miden: es la carga planificada que efectivamente hizo).
 */
export type ZoneSplit = { Z1: number; Z2: number; Z3: number };

export type ProgressInput = {
  weeks: ScheduledWeek[];
  weekRows: { week: number; distance_km_est: number; duration_min_est: number; running_sessions: number; zone_pct: ZoneSplit }[];
  days: { week: number; day_index: number; is_rest: boolean; minutes_by_intensity: Record<string, number> | null }[];
  logs: { date: string; planDayIndex: number | null; status: "completed" | "modified" | "skipped"; durationS: number | null; distanceM: number | null }[];
  dayMap: readonly number[];
  zoneMap: Record<string, string>;
  today: string;
};

export type ProgressRow = {
  weekStart: string;
  planWeek: number;
  plannedKm: number;
  plannedMin: number;
  realKm: number;
  realMin: number;
  /** Sesiones del plan con fecha hasta hoy. */
  dueSessions: number;
  doneSessions: number;
  /** Hechas / vencidas (null si todavía no venció ninguna). */
  adherence: number | null;
  zonesPlanned: ZoneSplit;
  /** Minutos por zona de las sesiones completadas (según el contenido). */
  zonesDoneMin: ZoneSplit;
};

export function weeklyProgress(input: ProgressInput): ProgressRow[] {
  const thisMonday = mondayOf(input.today);
  return input.weeks
    .filter((w): w is ScheduledWeek & { planWeek: number } => typeof w.planWeek === "number" && w.weekStart <= thisMonday)
    .map((w) => {
      const row = input.weekRows.find((r) => r.week === w.planWeek);
      const end = addDays(w.weekStart, 6);
      const logs = input.logs.filter((l) => l.date >= w.weekStart && l.date <= end && l.planDayIndex !== null);
      const sessions = input.days.filter((d) => d.week === w.planWeek && !d.is_rest);
      const due = sessions.filter((d) => addDays(w.weekStart, input.dayMap[d.day_index]!) <= input.today);
      const done = logs.filter((l) => l.status !== "skipped");
      const zones: ZoneSplit = { Z1: 0, Z2: 0, Z3: 0 };
      for (const l of done) {
        const day = sessions.find((d) => d.day_index === l.planDayIndex);
        for (const [intensity, min] of Object.entries(day?.minutes_by_intensity ?? {})) {
          const z = input.zoneMap[intensity] as keyof ZoneSplit | undefined;
          if (z && z in zones) zones[z] += min;
        }
      }
      // Si el detalle de la semana no está disponible (semanas Premium), se usan los totales públicos.
      const dueCount = sessions.length ? due.length : w.weekStart <= addDays(input.today, -6) ? (row?.running_sessions ?? 0) : 0;
      return {
        weekStart: w.weekStart,
        planWeek: w.planWeek,
        plannedKm: row?.distance_km_est ?? 0,
        plannedMin: row?.duration_min_est ?? 0,
        realKm: done.reduce((s, l) => s + (l.distanceM ?? 0), 0) / 1000,
        realMin: done.reduce((s, l) => s + (l.durationS ?? 0), 0) / 60,
        dueSessions: dueCount,
        doneSessions: done.length,
        adherence: dueCount > 0 ? Math.min(1, done.length / dueCount) : null,
        zonesPlanned: row?.zone_pct ?? { Z1: 0, Z2: 0, Z3: 0 },
        zonesDoneMin: zones,
      };
    });
}

/** Adherencia total: sesiones hechas sobre sesiones vencidas. */
export function overallAdherence(rows: ProgressRow[]): number | null {
  const due = rows.reduce((s, r) => s + r.dueSessions, 0);
  const done = rows.reduce((s, r) => s + Math.min(r.doneSessions, r.dueSessions), 0);
  return due > 0 ? done / due : null;
}

/** Porcentaje de cada zona sobre el total (redondeado), o null si no hay minutos. */
export function zonePercents(z: ZoneSplit): ZoneSplit | null {
  const total = z.Z1 + z.Z2 + z.Z3;
  if (total <= 0) return null;
  return { Z1: Math.round((z.Z1 / total) * 100), Z2: Math.round((z.Z2 / total) * 100), Z3: Math.round((z.Z3 / total) * 100) };
}
