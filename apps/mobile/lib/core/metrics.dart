// Cálculos equivalentes a packages/training-engine/src/metrics.ts.
// La generación de calendarios y la selección de planes NO se duplican aquí: las hace el servidor.

double? paceSecondsPerKm(int distanceM, int durationS) {
  if (distanceM <= 0 || durationS <= 0) return null;
  return durationS * 1000 / distanceM;
}

double? speedKmh(int distanceM, int durationS) {
  if (distanceM <= 0 || durationS <= 0) return null;
  return distanceM / durationS * 3.6;
}

class PeriodTotal {
  PeriodTotal(this.key, this.distanceM, this.durationS, this.workouts);
  final String key;
  int distanceM;
  int durationS;
  int workouts;
}

/// Lunes (YYYY-MM-DD) de la semana de una fecha local.
String mondayKey(DateTime local) {
  final d = DateTime.utc(local.year, local.month, local.day);
  final monday = d.subtract(Duration(days: d.weekday - 1));
  return monday.toIso8601String().substring(0, 10);
}

List<PeriodTotal> weeklyTotals(Iterable<({DateTime startedAt, int distanceM, int durationS, String status})> logs) {
  final map = <String, PeriodTotal>{};
  for (final l in logs) {
    if (l.status == 'skipped') continue;
    final key = mondayKey(l.startedAt.toLocal());
    final t = map.putIfAbsent(key, () => PeriodTotal(key, 0, 0, 0));
    t.distanceM += l.distanceM < 0 ? 0 : l.distanceM;
    t.durationS += l.durationS < 0 ? 0 : l.durationS;
    t.workouts += 1;
  }
  final list = map.values.toList()..sort((a, b) => a.key.compareTo(b.key));
  return list;
}
