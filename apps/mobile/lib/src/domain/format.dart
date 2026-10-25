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
  'easy_run': 'Carrera continua',
  'long_run': 'Carrera continua larga',
  'intervals': 'Intervalos',
  'tempo': 'Carrera continua exigente',
  'recovery': 'Carrera continua corta',
  'rest': 'Descanso',
  'strength': 'Fuerza complementaria',
  'test': 'Evaluación',
};

/// Títulos guardados en los planes DEMO anteriores (no editables) → nombre que se muestra (igual que la web).
const _legacySessionTitles = {
  'Rodaje fácil': 'Carrera continua',
  'Rodaje largo': 'Carrera continua larga',
  'Tempo': 'Carrera continua exigente',
  'Recuperación': 'Carrera continua corta',
};

/// Título de una sesión para mostrar (sin nombres de esfuerzo como «rodaje» o «tempo»).
String sessionTitle(String title) => _legacySessionTitles[title] ?? title;

const calendarStatusLabels = {'pending': 'Pendiente', 'completed': 'Completada', 'modified': 'Modificada', 'skipped': 'No realizada'};
