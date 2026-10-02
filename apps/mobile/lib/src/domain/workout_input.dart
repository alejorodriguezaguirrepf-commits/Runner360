import 'pace.dart';

/// Validación del registro manual de entrenamiento.
/// Equivalente a `workoutLogSchema` (Zod, packages/shared). El servidor (RLS y restricciones
/// CHECK de PostgreSQL) vuelve a validar: esto solo da feedback inmediato en la app.
enum WorkoutStatus { completed, modified, skipped }

class WorkoutInput {
  WorkoutInput({
    required this.date,
    required this.status,
    this.distanceM,
    this.durationS,
    this.rpe,
    this.painReported = false,
    this.comments,
    this.calendarEntryId,
  });

  final DateTime date;
  final WorkoutStatus status;
  final int? distanceM;
  final int? durationS;
  final int? rpe;
  final bool painReported;
  final String? comments;
  final String? calendarEntryId;

  Map<String, dynamic> toRow(String userId) => {
        'user_id': userId,
        'workout_date': _isoDate(date),
        'status': status.name,
        'distance_m': status == WorkoutStatus.skipped ? null : distanceM,
        'duration_s': status == WorkoutStatus.skipped ? null : durationS,
        'rpe': status == WorkoutStatus.skipped ? null : rpe,
        'pain_reported': painReported,
        'comments': (comments ?? '').trim().isEmpty ? null : comments!.trim(),
        'calendar_entry_id': calendarEntryId,
      };
}

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Resultado de validación: o un input válido, o errores por campo (mensajes en es-AR).
class WorkoutValidation {
  WorkoutValidation._(this.input, this.errors);
  final WorkoutInput? input;
  final Map<String, String> errors;
  bool get isValid => input != null;
}

WorkoutValidation validateWorkout({
  required DateTime date,
  required DateTime today,
  required WorkoutStatus status,
  required String distanceKm,
  required String duration,
  required String rpe,
  bool painReported = false,
  String? comments,
  String? calendarEntryId,
}) {
  final errors = <String, String>{};
  final day = DateTime(date.year, date.month, date.day);
  if (day.isAfter(DateTime(today.year, today.month, today.day))) {
    errors['workoutDate'] = 'No podés registrar entrenamientos futuros';
  }
  int? meters;
  int? seconds;
  int? rpeValue;
  if (status != WorkoutStatus.skipped) {
    if (distanceKm.trim().isNotEmpty) {
      meters = kmInputToMeters(distanceKm);
      if (meters == null) errors['distanceKm'] = 'Distancia: ingresá kilómetros, por ejemplo 10,5';
    }
    seconds = parseDuration(duration);
    if (seconds == null || seconds <= 0) {
      errors['duration'] = 'Duración: usá el formato mm:ss o h:mm:ss';
    } else if (seconds > 172800) {
      errors['duration'] = 'Duración fuera de rango';
    }
    if (rpe.trim().isNotEmpty) {
      rpeValue = int.tryParse(rpe.trim());
      if (rpeValue == null || rpeValue < 1 || rpeValue > 10) errors['rpe'] = 'RPE: entre 1 y 10';
    }
  }
  if ((comments ?? '').length > 2000) errors['comments'] = 'Máximo 2000 caracteres';
  if (errors.isNotEmpty) return WorkoutValidation._(null, errors);
  return WorkoutValidation._(
    WorkoutInput(
      date: day,
      status: status,
      distanceM: meters,
      durationS: seconds,
      rpe: rpeValue,
      painReported: painReported,
      comments: comments,
      calendarEntryId: calendarEntryId,
    ),
    const {},
  );
}
