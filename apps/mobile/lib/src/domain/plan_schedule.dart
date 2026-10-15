/// Calendario de un plan de la biblioteca (mismo cálculo que packages/plan-library/src/schedule.ts).
/// Fechas como "YYYY-MM-DD"; día de la semana 0 = lunes … 6 = domingo (igual que day_index).
library;

DateTime _utc(String date) => DateTime.parse('${date}T00:00:00Z');
String _iso(DateTime d) => d.toIso8601String().substring(0, 10);

String isoDate(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String addDays(String date, int days) => _iso(_utc(date).add(Duration(days: days)));
int daysBetween(String from, String to) => (_utc(to).difference(_utc(from)).inHours / 24).round();

/// 0 = lunes … 6 = domingo.
int weekdayOf(String date) => _utc(date).weekday - 1;
String mondayOf(String date) => addDays(date, -weekdayOf(date));

/// Tramo del calendario: desde [start] (lunes) se hace [planWeek] y luego una por semana. null = pausa.
class Segment {
  const Segment(this.start, this.planWeek);
  final String start;
  final int? planWeek;
}

/// Resultado de buscar la semana del plan de un lunes: [isPause] o el número [week].
class PlanWeek {
  const PlanWeek.week(int this.week) : isPause = false;
  const PlanWeek.pause() : week = null, isPause = true;
  final int? week;
  final bool isPause;
}

/// Tramos a partir del inicio y de los check-ins semanales (repetir, retroceder, pausar, retomar).
List<Segment> segmentsOf(String startDate, List<Map<String, dynamic>> checkins) {
  final segs = <Segment>[Segment(startDate, 1)];
  final sorted = checkins.where((c) => c['next_week_start'] != null || c['decision'] == 'pause').toList()
    ..sort((a, b) {
      final ws = (a['week_start'] as String).compareTo(b['week_start'] as String);
      return ws != 0 ? ws : ((a['created_at'] as String?) ?? '').compareTo((b['created_at'] as String?) ?? '');
    });
  for (final c in sorted) {
    final pause = c['decision'] == 'pause';
    // La pausa rige desde la semana en que se registró.
    final start = pause ? c['week_start'] as String : c['next_week_start'] as String;
    // Un tramo nuevo reemplaza a los que empezaban en la misma fecha o después.
    while (segs.length > 1 && segs.last.start.compareTo(start) >= 0) {
      segs.removeLast();
    }
    segs.add(Segment(start, pause ? null : c['next_plan_week'] as int?));
  }
  return segs;
}

/// Semana del plan del lunes [weekStart]; null si es antes de empezar o el plan terminó.
PlanWeek? planWeekAt(List<Segment> segments, String weekStart, int durationWeeks) {
  Segment? seg;
  for (final s in segments) {
    if (s.start.compareTo(weekStart) <= 0) seg = s;
  }
  if (seg == null) return null;
  if (seg.planWeek == null) return const PlanWeek.pause();
  final n = seg.planWeek! + daysBetween(seg.start, weekStart) ~/ 7;
  return n >= 1 && n <= durationWeeks ? PlanWeek.week(n) : null;
}

class ScheduledWeek {
  const ScheduledWeek(this.weekStart, this.planWeek);
  final String weekStart;

  /// null = semana en pausa.
  final int? planWeek;
}

/// Lunes en que se hace cada semana del plan, en orden (las repetidas aparecen más de una vez).
List<ScheduledWeek> scheduledWeeks(List<Segment> segments, int durationWeeks, {int limitWeeks = 120}) {
  final out = <ScheduledWeek>[];
  var week = segments.first.start;
  for (var i = 0; i < limitWeeks; i++) {
    final n = planWeekAt(segments, week, durationWeeks);
    if (n == null) {
      if (!segments.any((s) => s.start.compareTo(week) > 0)) break;
    } else {
      out.add(ScheduledWeek(week, n.week));
    }
    week = addDays(week, 7);
  }
  return out;
}

/// Minutos → 36' · 1 h 05'. Con [round], al minuto (totales).
String formatPlanMinutes(num? minutes, {bool round = false}) {
  if (minutes == null || minutes < 0) return '—';
  final totalS = round ? minutes.round() * 60 : (minutes * 60).round();
  final h = totalS ~/ 3600;
  final m = (totalS % 3600) ~/ 60;
  final s = totalS % 60;
  final sec = s > 0 ? ' ${s.toString().padLeft(2, '0')}"' : '';
  return h > 0 ? "$h h ${m.toString().padLeft(2, '0')}'$sec" : "$m'$sec";
}

/// Km con un decimal y coma: 5,4 km.
String formatKm1(num? km) => km == null ? '—' : '${km.toStringAsFixed(1).replaceAll('.', ',')} km';

/// "19 oct": fecha sin el nombre del día (los días se nombran por número).
String shortDate(String iso) {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  final d = _utc(iso);
  return '${d.day} ${months[d.month - 1]}';
}
