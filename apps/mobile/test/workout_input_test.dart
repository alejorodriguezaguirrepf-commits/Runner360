import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/format.dart';
import 'package:runner360/src/domain/workout_input.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  final today = DateTime(2026, 10, 2);

  test('normaliza a metros y segundos', () {
    final r = validateWorkout(date: today, today: today, status: WorkoutStatus.completed, distanceKm: '10,5', duration: '55:30', rpe: '5');
    expect(r.isValid, isTrue);
    expect(r.input!.distanceM, 10500);
    expect(r.input!.durationS, 3330);
    expect(r.input!.toRow('u')['workout_date'], '2026-10-02');
  });

  test('exige duración salvo si no se realizó', () {
    expect(validateWorkout(date: today, today: today, status: WorkoutStatus.completed, distanceKm: '5', duration: '', rpe: '').errors.keys, contains('duration'));
    expect(validateWorkout(date: today, today: today, status: WorkoutStatus.skipped, distanceKm: '', duration: '', rpe: '').isValid, isTrue);
  });

  test('rechaza fechas futuras, RPE y distancias inválidas', () {
    final r = validateWorkout(date: DateTime(2026, 10, 3), today: today, status: WorkoutStatus.completed, distanceKm: 'diez', duration: '30:00', rpe: '11');
    expect(r.errors.keys, containsAll(['workoutDate', 'distanceKm', 'rpe']));
  });

  test('formatos es-AR', () async {
    await initializeDateFormatting('es_AR');
    expect(formatKm(10500), '10,5 km');
    expect(formatKm(5000), '5 km');
    expect(formatKm(21097), '21,1 km');
    expect(formatMinutesLong(3900), '1 h 05 min');
  });
}
