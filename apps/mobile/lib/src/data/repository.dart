import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/distance_text.dart';
import '../domain/plan_schedule.dart';
import '../domain/workout_input.dart';

/// Acceso a datos. Todas las consultas usan la sesión del usuario y están sujetas a RLS:
/// la app nunca puede leer ni escribir datos de otros usuarios.
class Repository {
  Repository(this.client);
  final SupabaseClient client;

  String get userId => client.auth.currentUser!.id;

  Future<Map<String, dynamic>?> profile() =>
      client.from('profiles').select('id, display_name, role, onboarding_completed_at, timezone').eq('id', userId).maybeSingle();

  Future<Map<String, dynamic>?> activePlan() => client
      .from('user_training_plans')
      .select('id, start_date, start_week, race_date, plan_version_id, version:training_plan_versions(name, is_demo, duration_weeks)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

  Future<List<Map<String, dynamic>>> calendar(String userPlanId) => client
      .from('user_training_calendar')
      .select(
        'id, scheduled_date, week_number, session_number, status, session:training_sessions(title, session_type, duration_s, distance_m, intensity, rpe_min, rpe_max, warmup, main_set, cooldown, stop_criteria)',
      )
      .eq('user_plan_id', userPlanId)
      .order('scheduled_date');

  Future<List<Map<String, dynamic>>> workoutsSince(String isoDate) => client
      .from('workout_logs')
      .select('id, workout_date, status, distance_m, duration_s, rpe')
      .eq('user_id', userId)
      .gte('workout_date', isoDate)
      .order('workout_date', ascending: false);

  Future<void> saveWorkout(WorkoutInput input) => client.from('workout_logs').insert(input.toRow(userId));

  Future<bool> hasPremium() async => (await client.rpc('has_premium', params: {'p_user': userId})) == true;

  // ------------------------------------------------------------ Plan de la biblioteca
  // Mismo modelo que la web: inscripción (plan_enrollments), contenido (library_*), check-ins,
  // registros y valoraciones. RLS limita el detalle día por día a las semanas liberadas.

  /// Inscripción vigente (activa o en pausa) con su plan y el calendario calculado; null si no hay.
  Future<EnrolledPlan?> enrolledPlan() async {
    final e = await client
        .from('plan_enrollments')
        .select('id, content_version, plan_id, start_date, race_date, day_map, status')
        .eq('user_id', userId)
        .inFilter('status', ['active', 'paused'])
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (e == null) return null;
    final version = e['content_version'] as String;
    final planId = e['plan_id'] as String;
    final results = await Future.wait([
      client
          .from('library_plans')
          .select('title, chapter, distance_label, level, duration_label, duration_weeks, days_per_week, strength_routine')
          .eq('content_version', version)
          .eq('id', planId)
          .single(),
      client
          .from('weekly_checkins')
          .select('week_start, decision, next_week_start, next_plan_week, created_at')
          .eq('enrollment_id', e['id'] as String)
          .order('week_start')
          .order('created_at'),
      client.from('library_days').select('week, day_index, is_rest').eq('content_version', version).eq('plan_id', planId),
      client.from('library_versions').select('model_runner_assumptions').eq('content_version', version).maybeSingle(),
      client.from('user_pace_tests').select('distance_m, time_s, updated_at').eq('user_id', userId).maybeSingle(),
    ]);
    final plan = results[0] as Map<String, dynamic>;
    final checkins = (results[1] as List).cast<Map<String, dynamic>>();
    final training = <int, List<int>>{};
    for (final r in (results[2] as List).cast<Map<String, dynamic>>()) {
      final list = training.putIfAbsent(r['week'] as int, () => []);
      if (r['is_rest'] != true) list.add(r['day_index'] as int);
    }
    // Ritmo para mostrar la parte principal en km: test de la calculadora (≤ 8 semanas) o corredor modelo.
    final assumptions = (results[3] as Map<String, dynamic>?)?['model_runner_assumptions'] as Map<String, dynamic>?;
    final model = modelSpeeds(assumptions, (plan['chapter'] as num?)?.toInt() ?? 0);
    final test = results[4] as Map<String, dynamic>?;
    final testDate = (test?['updated_at'] as String?)?.substring(0, 10);
    final recent = testDate != null && daysBetween(testDate, isoDate(DateTime.now())) <= 56;
    final speeds = model == null
        ? null
        : recent
        ? runnerSpeeds(model, testKm: (test!['distance_m'] as num) / 1000, testS: (test['time_s'] as num).toInt())
        : model;
    return EnrolledPlan(
      enrollment: e,
      plan: plan,
      segments: segmentsOf(e['start_date'] as String, checkins),
      trainingDays: training,
      speeds: speeds,
      testDate: recent ? testDate : null,
    );
  }

  /// Los 7 días de una semana del plan ([] si la semana no está liberada).
  Future<List<Map<String, dynamic>>> planWeekDays(EnrolledPlan p, int week) async =>
      (await client
              .from('library_days')
              .select(
                'day_index, is_rest, strength_only, session_type, category, short_label, warmup, main_set, cooldown, '
                'duration_min_est, distance_km_est, intensity, technical_notes, strength_after',
              )
              .eq('content_version', p.version)
              .eq('plan_id', p.planId)
              .eq('week', week)
              .order('day_index'))
          .cast<Map<String, dynamic>>();

  /// Fechas con entrenamiento registrado (hecho o modificado) en un rango de la inscripción.
  Future<Set<String>> doneDates(EnrolledPlan p, String from, String to) async {
    final rows = await client
        .from('workout_logs')
        .select('workout_date, status')
        .eq('enrollment_id', p.enrollmentId)
        .gte('workout_date', from)
        .lte('workout_date', to);
    return rows.where((r) => r['status'] != 'skipped').map((r) => r['workout_date'] as String).toSet();
  }

  Future<List<Map<String, dynamic>>> ratings(EnrolledPlan p) async =>
      (await client
              .from('session_ratings')
              .select('workout_date, plan_week, plan_day_index, rating, note')
              .eq('enrollment_id', p.enrollmentId)
              .order('workout_date', ascending: false))
          .cast<Map<String, dynamic>>();

  /// "¿Cómo te fue?": una valoración por día (se puede cambiar). La base exige que sea propia.
  Future<void> saveRating(EnrolledPlan p, {required String date, required int planWeek, required int dayIndex, required int rating, String? note}) =>
      client.from('session_ratings').upsert({
        'user_id': userId,
        'enrollment_id': p.enrollmentId,
        'workout_date': date,
        'plan_week': planWeek,
        'plan_day_index': dayIndex,
        'rating': rating,
        'note': (note == null || note.trim().isEmpty) ? null : note.trim(),
      }, onConflict: 'enrollment_id,workout_date');
}

/// Inscripción a un plan de la biblioteca con su calendario.
class EnrolledPlan {
  EnrolledPlan({required this.enrollment, required this.plan, required this.segments, required this.trainingDays, this.speeds, this.testDate});
  final Map<String, dynamic> enrollment;
  final Map<String, dynamic> plan;
  final List<Segment> segments;

  /// Días de entrenamiento (day_index) de cada semana liberada (muestra gratis o meses pagos).
  final Map<int, List<int>> trainingDays;

  /// Velocidad por intensidad para mostrar la parte principal en km (null = queda en minutos).
  final Speeds? speeds;

  /// Fecha del test de la calculadora usado para los km (null = ritmo estimado del nivel del plan).
  final String? testDate;

  Set<int> get openWeeks => trainingDays.keys.toSet();

  /// Número de día de entrenamiento (Día 1, Día 2…) según el orden real de la semana; null si no se sabe.
  int? trainingDayNumber(int week, int dayIndex) {
    final order = [...?trainingDays[week]]..sort((a, b) => dayMap[a].compareTo(dayMap[b]));
    final i = order.indexOf(dayIndex);
    return i < 0 ? null : i + 1;
  }

  String get enrollmentId => enrollment['id'] as String;
  String get version => enrollment['content_version'] as String;
  String get planId => enrollment['plan_id'] as String;
  bool get paused => enrollment['status'] == 'paused';
  int get durationWeeks => plan['duration_weeks'] as int;
  List<int> get dayMap => (enrollment['day_map'] as List).cast<int>();
  List<ScheduledWeek> get weeks => scheduledWeeks(segments, durationWeeks);

  /// Fecha real de cada día del plan en la semana que empieza en [weekStart].
  String dateOf(String weekStart, int dayIndex) => addDays(weekStart, dayMap[dayIndex]);
}
