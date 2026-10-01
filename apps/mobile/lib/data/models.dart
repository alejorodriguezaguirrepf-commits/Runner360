class PlannedSession {
  PlannedSession({
    required this.id,
    required this.type,
    required this.title,
    required this.objective,
    required this.intensity,
    this.durationS,
    this.distanceM,
    this.rpeMin,
    this.rpeMax,
    this.warmup = '',
    this.mainSet = '',
    this.cooldown = '',
  });
  final String id;
  final String type;
  final String title;
  final String objective;
  final String intensity;
  final int? durationS;
  final int? distanceM;
  final int? rpeMin;
  final int? rpeMax;
  final String warmup;
  final String mainSet;
  final String cooldown;

  factory PlannedSession.fromRow(Map<String, dynamic> r) => PlannedSession(
        id: r['id'] as String,
        type: r['session_type'] as String,
        title: r['title'] as String,
        objective: (r['objective'] ?? '') as String,
        intensity: r['intensity'] as String,
        durationS: r['duration_s'] as int?,
        distanceM: r['distance_m'] as int?,
        rpeMin: r['rpe_min'] as int?,
        rpeMax: r['rpe_max'] as int?,
        warmup: (r['warmup'] ?? '') as String,
        mainSet: (r['main_set'] ?? '') as String,
        cooldown: (r['cooldown'] ?? '') as String,
      );
}

class CalendarItem {
  CalendarItem({required this.id, required this.date, required this.weekNumber, required this.session, this.logStatus});
  final String id;
  final String date; // YYYY-MM-DD
  final int weekNumber;
  final PlannedSession session;
  final String? logStatus;
}

class ActivePlan {
  ActivePlan({required this.id, required this.name, required this.isDemo, required this.durationWeeks, required this.startDate, required this.calendar});
  final String id;
  final String name;
  final bool isDemo;
  final int durationWeeks;
  final String startDate;
  final List<CalendarItem> calendar;
}

class WorkoutLog {
  WorkoutLog({required this.id, required this.startedAt, required this.distanceM, required this.durationS, required this.status, this.rpe});
  final String id;
  final DateTime startedAt;
  final int distanceM;
  final int durationS;
  final String status;
  final int? rpe;

  factory WorkoutLog.fromRow(Map<String, dynamic> r) => WorkoutLog(
        id: r['id'] as String,
        startedAt: DateTime.parse(r['started_at'] as String),
        distanceM: r['distance_m'] as int,
        durationS: r['duration_s'] as int,
        status: r['status'] as String,
        rpe: r['rpe'] as int?,
      );
}

const sessionTypeLabels = {
  'easy_run': 'Rodaje fácil',
  'long_run': 'Rodaje largo',
  'intervals': 'Intervalos',
  'tempo': 'Tempo / umbral',
  'recovery': 'Recuperación',
  'rest': 'Descanso',
  'strength': 'Fuerza complementaria',
  'test': 'Evaluación / test',
  'walk_run': 'Caminata y trote',
};

const intensityLabels = {
  'very_easy': 'Muy suave',
  'easy': 'Suave',
  'moderate': 'Moderada',
  'hard': 'Exigente',
  'very_hard': 'Muy exigente',
};
