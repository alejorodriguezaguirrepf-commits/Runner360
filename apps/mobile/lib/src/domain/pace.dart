/// Cálculos de ritmo y duración. Port 1:1 de `packages/training-engine/src/pace.ts`.
///
/// La fuente de verdad es el motor TypeScript. Ambos lados se prueban contra los mismos
/// vectores (`packages/training-engine/test-vectors/calculations.json`): si cambia un cálculo,
/// debe cambiar en los dos.
library;

/// Ritmo medio en segundos por kilómetro, o `null` si los datos no son válidos.
double? paceSecondsPerKm(num distanceM, num durationS) {
  if (!distanceM.isFinite || !durationS.isFinite) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (durationS * 1000) / distanceM;
}

/// Velocidad media en km/h, o `null` si los datos no son válidos.
double? speedKmh(num distanceM, num durationS) {
  if (!distanceM.isFinite || !durationS.isFinite) return null;
  if (distanceM <= 0 || durationS <= 0) return null;
  return (distanceM / 1000) / (durationS / 3600);
}

/// Parsea "mm:ss" o "h:mm:ss" a segundos. `null` si el formato es inválido.
int? parseDuration(String input) {
  final s = input.trim();
  if (!RegExp(r'^\d{1,3}(:\d{1,2}){1,2}$').hasMatch(s)) return null;
  final parts = s.split(':').map(int.parse).toList();
  if (parts.length == 2) {
    if (parts[1] > 59) return null;
    return parts[0] * 60 + parts[1];
  }
  if (parts[1] > 59 || parts[2] > 59) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/// Formatea segundos como "h:mm:ss" o "m:ss".
String formatDuration(num totalSeconds) {
  if (!totalSeconds.isFinite || totalSeconds < 0) return '—';
  final t = totalSeconds.round();
  final h = t ~/ 3600;
  final m = (t % 3600) ~/ 60;
  final s = t % 60;
  final ss = s.toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$ss' : '$m:$ss';
}

/// Formatea un ritmo (s/km) como "m:ss" redondeando al segundo.
String formatPace(num? paceSPerKm) {
  if (paceSPerKm == null || !paceSPerKm.isFinite || paceSPerKm <= 0) return '—';
  return formatDuration(paceSPerKm.round());
}

/// Kilómetros ingresados por el usuario (coma o punto) → metros enteros. `null` si es inválido.
int? kmInputToMeters(String input) {
  final raw = input.trim().replaceFirst(',', '.');
  if (!RegExp(r'^\d{1,3}(\.\d{1,3})?$').hasMatch(raw)) return null;
  final parts = raw.split('.');
  final decimals = parts.length > 1 ? parts[1].padRight(3, '0') : '000';
  return int.parse(parts[0]) * 1000 + int.parse(decimals);
}

/// Parciales con ritmo parejo; el último coincide exactamente con el tiempo objetivo.
List<int> evenSplitsCumulative(num distanceM, num targetTimeS, num splitM) {
  if (distanceM <= 0 || targetTimeS <= 0 || splitM <= 0) {
    throw ArgumentError('Valores inválidos');
  }
  final count = (distanceM / splitM - 1e-9).ceil();
  return List<int>.generate(count, (i) {
    final idx = i + 1;
    if (idx == count) return targetTimeS.round();
    final cumulativeDistance = (idx * splitM) < distanceM ? idx * splitM : distanceM;
    return (targetTimeS * cumulativeDistance / distanceM).round();
  });
}
