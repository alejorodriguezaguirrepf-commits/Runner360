import 'package:intl/intl.dart';

/// Formatos es-AR. Equivalentes a packages/shared/src/format.ts y verificados con los mismos
/// vectores de prueba (packages/training-engine/fixtures/pace-vectors.json).

String formatDuration(num totalSeconds) {
  if (!totalSeconds.isFinite || totalSeconds < 0) return '—';
  final s = totalSeconds.round();
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final sec = s % 60;
  final mm = h > 0 ? m.toString().padLeft(2, '0') : m.toString();
  return '${h > 0 ? '$h:' : ''}$mm:${sec.toString().padLeft(2, '0')}';
}

String formatPace(num? secondsPerKm) {
  if (secondsPerKm == null || !secondsPerKm.isFinite || secondsPerKm <= 0) return '—';
  return '${formatDuration(secondsPerKm)} /km';
}

String formatKm(int meters, {int fractionDigits = 2}) {
  final f = NumberFormat.decimalPatternDigits(locale: 'es_AR', decimalDigits: fractionDigits);
  var text = f.format(meters / 1000);
  // Igual que Intl en JS con minimumFractionDigits 0: sin ceros finales.
  if (text.contains(',')) {
    text = text.replaceFirst(RegExp(r',?0+$'), '');
  }
  return '$text km';
}

/// "45" (minutos), "45:30" (mm:ss) o "1:02:03" (h:mm:ss) → segundos. null si es inválida.
int? parseDuration(String input) {
  final raw = input.trim();
  if (raw.isEmpty) return null;
  if (RegExp(r'^\d+$').hasMatch(raw)) return int.parse(raw) * 60;
  final parts = raw.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => RegExp(r'^\d+$').hasMatch(p))) return null;
  final n = parts.map(int.parse).toList();
  if (n.length == 2) {
    if (n[1] >= 60) return null;
    return n[0] * 60 + n[1];
  }
  if (n[1] >= 60 || n[2] >= 60) return null;
  return n[0] * 3600 + n[1] * 60 + n[2];
}

/// "10,5" o "10.5" → metros enteros, sin aritmética de punto flotante.
int? parseKmToMeters(String input) {
  final raw = input.trim().replaceFirst(',', '.');
  final m = RegExp(r'^(\d{1,4})(?:\.(\d{1,3}))?$').firstMatch(raw);
  if (m == null) return null;
  final whole = int.parse(m.group(1)!);
  final frac = (m.group(2) ?? '').padRight(3, '0');
  return whole * 1000 + int.parse(frac);
}
