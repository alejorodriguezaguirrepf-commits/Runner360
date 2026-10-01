import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config.dart';
import '../core/validation.dart';
import 'models.dart';

/// Acceso a datos. Lecturas y escrituras propias van directo a Supabase (protegidas por RLS);
/// las operaciones con reglas de negocio (inicio de plan) pasan por la API web, que usa el motor.
class Repository {
  Repository(this.client);
  final SupabaseClient client;

  String get userId => client.auth.currentUser!.id;

  Future<({String? displayName, bool onboarded})> profile() async {
    final r = await client.from('profiles').select('display_name, onboarding_completed_at').eq('id', userId).maybeSingle();
    return (displayName: r?['display_name'] as String?, onboarded: r?['onboarding_completed_at'] != null);
  }

  Future<ActivePlan?> activePlan() async {
    final up = await client
        .from('user_training_plans')
        .select('id, start_date, training_plan_versions(name, duration_weeks, training_plans(is_demo))')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
    if (up == null) return null;
    final rows = await client
        .from('user_training_calendar')
        .select('id, scheduled_date, week_number, training_sessions(*), workout_logs(status)')
        .eq('user_plan_id', up['id'] as String)
        .order('scheduled_date');
    final version = up['training_plan_versions'] as Map<String, dynamic>;
    return ActivePlan(
      id: up['id'] as String,
      name: version['name'] as String,
      isDemo: (version['training_plans'] as Map<String, dynamic>)['is_demo'] as bool,
      durationWeeks: version['duration_weeks'] as int,
      startDate: up['start_date'] as String,
      calendar: [
        for (final r in rows)
          CalendarItem(
            id: r['id'] as String,
            date: r['scheduled_date'] as String,
            weekNumber: r['week_number'] as int,
            session: PlannedSession.fromRow(r['training_sessions'] as Map<String, dynamic>),
            logStatus: switch (r['workout_logs']) {
              final List l when l.isNotEmpty => (l.first as Map)['status'] as String,
              final Map m => m['status'] as String,
              _ => null,
            },
          ),
      ],
    );
  }

  Future<List<WorkoutLog>> workouts({int limit = 200}) async {
    final rows = await client
        .from('workout_logs')
        .select('id, started_at, distance_m, duration_s, status, rpe')
        .eq('user_id', userId)
        .order('started_at', ascending: false)
        .limit(limit);
    return rows.map(WorkoutLog.fromRow).toList();
  }

  Future<void> saveWorkout(WorkoutInput w) async {
    final errors = validateWorkout(w);
    if (errors.isNotEmpty) throw ArgumentError(errors.values.first);
    await client.from('workout_logs').insert({
      'user_id': userId,
      'started_at': w.startedAt.toUtc().toIso8601String(),
      'distance_m': w.status == 'skipped' ? 0 : w.distanceM,
      'duration_s': w.status == 'skipped' ? 0 : w.durationS,
      'rpe': w.rpe,
      'avg_hr': w.avgHr,
      'max_hr': w.maxHr,
      'notes': w.notes,
      'status': w.status,
      'calendar_entry_id': w.calendarEntryId,
    });
  }

  /// Inicia el plan sugerido usando el mismo motor que la web (API con Bearer token).
  Future<String?> startSuggestedPlan({String choice = 'recommended'}) async {
    if (AppConfig.apiBaseUrl.isEmpty) return 'API_BASE_URL no configurada';
    final token = client.auth.currentSession?.accessToken;
    final res = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/api/mobile/plans/start'),
      headers: {'authorization': 'Bearer $token', 'content-type': 'application/json'},
      body: jsonEncode({'choice': choice}),
    );
    if (res.statusCode == 200) return null;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (body['error'] ?? 'error').toString();
  }
}
