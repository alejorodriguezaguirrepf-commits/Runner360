import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/core/validation.dart';

void main() {
  final now = DateTime(2026, 10, 1, 12);
  WorkoutInput w({int d = 8000, int s = 2700, String status = 'completed', int? avg, int? max, int? rpe, DateTime? at}) =>
      WorkoutInput(startedAt: at ?? DateTime(2026, 10, 1, 7), distanceM: d, durationS: s, status: status, avgHr: avg, maxHr: max, rpe: rpe);

  test('acepta datos válidos', () => expect(validateWorkout(w(), now: now), isEmpty));
  test('exige duración en sesiones completadas', () => expect(validateWorkout(w(s: 0), now: now), contains('durationS')));
  test('permite no realizada sin duración', () => expect(validateWorkout(w(s: 0, d: 0, status: 'skipped'), now: now), isEmpty));
  test('FC máxima >= media', () => expect(validateWorkout(w(avg: 150, max: 120), now: now), contains('maxHr')));
  test('RPE 1-10', () => expect(validateWorkout(w(rpe: 11), now: now), contains('rpe')));
  test('rechaza fechas futuras', () => expect(validateWorkout(w(at: DateTime(2026, 10, 2)), now: now), contains('startedAt')));
}
