import 'package:intl/intl.dart';

/// Formatos de presentación en es-AR (equivalentes a packages/shared/src/format.ts).
const locale = 'es_AR';

String formatKm(int? meters) {
  if (meters == null) return '—';
  final f = NumberFormat.decimalPatternDigits(locale: locale, decimalDigits: 2);
  var text = f.format(meters / 1000);
  // Igual que la web: sin ceros decimales sobrantes ("10,5 km", "5 km").
  if (text.contains(',')) text = text.replaceFirst(RegExp(r',?0+$'), '');
  return '$text km';
}

String formatMinutesLong(int? seconds) {
  if (seconds == null || seconds <= 0) return '—';
  final totalMin = (seconds / 60).round();
  final h = totalMin ~/ 60;
  final m = totalMin % 60;
  if (h == 0) return '$m min';
  return m == 0 ? '$h h' : '$h h ${m.toString().padLeft(2, '0')} min';
}

String formatDateShort(DateTime d) => DateFormat('EEE d MMM', locale).format(d);
String formatDateLong(DateTime d) => DateFormat("EEEE d 'de' MMMM", locale).format(d);

const sessionTypeLabels = {
  'easy_run': 'Rodaje fácil',
  'long_run': 'Rodaje largo',
  'intervals': 'Intervalos',
  'tempo': 'Tempo / umbral',
  'recovery': 'Recuperación',
  'rest': 'Descanso',
  'strength': 'Fuerza complementaria',
  'test': 'Evaluación',
};

const calendarStatusLabels = {
  'pending': 'Pendiente',
  'completed': 'Completada',
  'modified': 'Modificada',
  'skipped': 'No realizada',
};
