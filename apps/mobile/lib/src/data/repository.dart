import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
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
      .select('id, scheduled_date, week_number, session_number, status, session:training_sessions(title, session_type, duration_s, distance_m, intensity, rpe_min, rpe_max, warmup, main_set, cooldown, stop_criteria)')
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

  /// Asignación de plan: delega en el backend web, que ejecuta el motor de entrenamiento
  /// (misma lógica que la web; no se duplica en Dart).
  Future<Map<String, dynamic>> enroll({bool dryRun = false}) async {
    if (AppConfig.apiBaseUrl.isEmpty) {
      return {'kind': 'not_configured', 'message': 'Falta API_BASE_URL para asignar planes desde la app.'};
    }
    final token = client.auth.currentSession?.accessToken;
    final res = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/api/v1/plan/enroll'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'dryRun': dryRun}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
