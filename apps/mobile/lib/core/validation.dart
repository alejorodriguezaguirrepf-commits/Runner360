/// Validación de registro de entrenamiento equivalente a `workoutLogSchema` (packages/shared/src/schemas.ts).
/// La base de datos vuelve a validar con restricciones CHECK y RLS.
class WorkoutInput {
  WorkoutInput({
    required this.startedAt,
    required this.distanceM,
    required this.durationS,
    required this.status,
    this.rpe,
    this.avgHr,
    this.maxHr,
    this.notes,
    this.calendarEntryId,
  });
  final DateTime startedAt;
  final int distanceM;
  final int durationS;
  final String status; // completed | modified | skipped
  final int? rpe;
  final int? avgHr;
  final int? maxHr;
  final String? notes;
  final String? calendarEntryId;
}

Map<String, String> validateWorkout(WorkoutInput w, {DateTime? now}) {
  final errors = <String, String>{};
  final ref = now ?? DateTime.now();
  if (!['completed', 'modified', 'skipped'].contains(w.status)) errors['status'] = 'Estado inválido';
  if (w.distanceM < 0 || w.distanceM > 400000) errors['distanceM'] = 'Distancia fuera de rango';
  if (w.durationS < 0 || w.durationS > 172800) errors['durationS'] = 'Duración fuera de rango';
  if (w.status != 'skipped' && w.durationS <= 0) errors['durationS'] = 'Ingresá la duración';
  if (w.rpe != null && (w.rpe! < 1 || w.rpe! > 10)) errors['rpe'] = 'El RPE va de 1 a 10';
  for (final (key, hr) in [('avgHr', w.avgHr), ('maxHr', w.maxHr)]) {
    if (hr != null && (hr < 30 || hr > 250)) errors[key] = 'Frecuencia cardíaca fuera de rango';
  }
  if (w.avgHr != null && w.maxHr != null && w.maxHr! < w.avgHr!) {
    errors['maxHr'] = 'La FC máxima no puede ser menor que la media';
  }
  if ((w.notes ?? '').length > 1000) errors['notes'] = 'Máximo 1000 caracteres';
  if (w.startedAt.isAfter(ref.add(const Duration(minutes: 5)))) errors['startedAt'] = 'La fecha no puede ser futura';
  return errors;
}
