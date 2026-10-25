/// Parte principal en km en lugar de minutos (mismo cálculo que packages/plan-library/src/distance.ts).
///
/// Velocidad por intensidad: con un test reciente, la del corredor normalizada a ~30 minutos (Riegel)
/// con las proporciones del corredor modelo del capítulo; sin test, la del corredor modelo.
/// Quedan en minutos: pausas, progresivos, cuestas, caminata/trote, cambios de ritmo y tests.
/// Redondeo: continuo a 0,5 km; pasadas de menos de 2 km a 100 m.
library;

import 'dart:math' as math;

typedef Speeds = Map<String, double>;

const double _riegel = 1.06;
const Speeds _reference = {'rec': 8.5, 'suave': 9.5, 'mod': 10.5, 'umb': 11.0, 'r10': 11.3, 'int': 11.8, 'vel': 13.0, 'test': 11.2, 'r5': 11.8, 'r3': 12.3};

/// Velocidades del corredor modelo del capítulo (`chapterN_kmh`).
Speeds? modelSpeeds(Map<String, dynamic>? assumptions, int chapter) {
  final raw = assumptions?['chapter${chapter}_kmh'];
  if (raw is! Map) return null;
  final out = <String, double>{};
  raw.forEach((k, v) {
    if (v is num && v > 0) out['$k'] = v.toDouble();
  });
  return out.isEmpty ? null : out;
}

/// Velocidad (km/h) equivalente a 30 minutos a partir de un test de cualquier duración.
double speed30FromTest(double distanceKm, int timeS) => distanceKm * math.pow(1800 / timeS, 1 / _riegel) * 2;

Speeds runnerSpeeds(Speeds model, {double? testKm, int? testS}) {
  if (testKm == null || testS == null) return {...model};
  final v30 = speed30FromTest(testKm, testS);
  final base = model.containsKey('test') ? model : _reference;
  final out = <String, double>{};
  base.forEach((k, v) {
    if (k != 'walk') out[k] = v30 * (v / base['test']!);
  });
  if (model['walk'] != null) out['walk'] = model['walk']!;
  return out;
}

int? parseContentTime(String t) {
  var m = RegExp(r"^(\d+)h(\d{2})'$").firstMatch(t);
  if (m != null) return int.parse(m[1]!) * 3600 + int.parse(m[2]!) * 60;
  m = RegExp(r"""^(\d+)'(?:(\d{2})")?$""").firstMatch(t);
  if (m != null) return int.parse(m[1]!) * 60 + int.parse(m[2] ?? '0');
  m = RegExp(r'^(\d+)"$').firstMatch(t);
  return m == null ? null : int.parse(m[1]!);
}

String? intensityOf(String text) {
  final t = text.toLowerCase();
  if (RegExp(r'ritmo (objetivo )?de 3[–-]5 km|ritmo de 5[–-]10 km').hasMatch(t)) return 'int';
  if (RegExp(r'ritmo (objetivo )?de 3 km').hasMatch(t)) return 'r3';
  if (RegExp(r'ritmo (objetivo )?de 5 km').hasMatch(t)) return 'r5';
  if (RegExp(r'ritmo (objetivo )?de 10 km').hasMatch(t)) return 'r10';
  if (RegExp(r'ritmo (objetivo )?de 21,1 km|media marat').hasMatch(t)) return 'h21';
  if (RegExp(r'marat[oó]n').hasMatch(t)) return 'rp';
  if (RegExp(r'muy suave|recuperaci[oó]n').hasMatch(t)) return 'rec';
  if (t.contains('umbral')) return 'umb';
  if (t.contains('moderado')) return 'mod';
  if (t.contains('intenso')) return 'int';
  if (t.contains('velocidad')) return 'vel';
  if (t.contains('suave')) return 'suave';
  return null;
}

const _fallback = {
  'r3': ['int', 'vel'],
  'r5': ['int'],
  'r10': ['int', 'umb'],
  'h21': ['rp', 'umb'],
  'rp': ['mod', 'umb'],
};

double? _speedFor(Speeds s, String? key) {
  if (key == null) return null;
  for (final k in [key, ...?_fallback[key]]) {
    if (s[k] != null) return s[k];
  }
  return null;
}

double roundHalfKm(double km) => math.max(0.5, (km * 2).round() / 2);

String formatKmShort(double km) {
  final rounded = (km * 10).round() / 10;
  final text = rounded == rounded.truncateToDouble() ? rounded.toInt().toString() : rounded.toStringAsFixed(1).replaceAll('.', ',');
  return '$text km';
}

String formatRepDistance(double km) {
  if (km >= 2) return formatKmShort(roundHalfKm(km));
  final m = math.max(100, ((km * 1000) / 100).round() * 100);
  return m < 1000 ? '$m m' : formatKmShort(m / 1000);
}

double _kmOf(int seconds, double kmh) => seconds / 3600 * kmh;

const _time = r"""(\d+h\d{2}'|\d+'(?:\d{2}")?|\d+")""";
final _skip = RegExp(r"test|caminata|subida|desde el minuto|\(\d+' trote", caseSensitive: false);

String? mainSetInKm(String? text, Speeds? speeds) {
  if (text == null || text.isEmpty || speeds == null || _skip.hasMatch(text)) return text;

  var m = RegExp('^$_time: primeros $_time en (.+?) y últimos $_time en (.+)\$').firstMatch(text);
  if (m != null) {
    final s1 = _speedFor(speeds, intensityOf(m[3]!));
    final s2 = _speedFor(speeds, intensityOf(m[5]!));
    final sec1 = parseContentTime(m[2]!);
    final sec2 = parseContentTime(m[4]!);
    if (s1 == null || s2 == null || sec1 == null || sec2 == null) return text;
    final k1 = roundHalfKm(_kmOf(sec1, s1));
    final k2 = roundHalfKm(_kmOf(sec2, s2));
    return '${formatKmShort(k1 + k2)}: primeros ${formatKmShort(k1)} en ${m[3]} y últimos ${formatKmShort(k2)} en ${m[5]}';
  }

  m = RegExp('^(\\d+) × $_time (.+)\$').firstMatch(text);
  if (m != null) {
    final sec = parseContentTime(m[2]!);
    final rest = m[3]!;
    final s = _speedFor(speeds, intensityOf(rest.split(',').first));
    if (sec == null || sec < 60 || s == null) return text;
    return '${m[1]} × ${formatRepDistance(_kmOf(sec, s))} $rest';
  }

  m = RegExp('^$_time( .+)\$').firstMatch(text);
  if (m != null) {
    final sec = parseContentTime(m[1]!);
    final rest = m[2]!;
    final s = _speedFor(speeds, intensityOf(rest.split(';').first));
    if (sec == null || sec < 300 || s == null) return text;
    return '${formatKmShort(roundHalfKm(_kmOf(sec, s)))}$rest';
  }
  return text;
}

/// La semana tiene alguna parte principal convertida de minutos a km (contenido anterior a 2026.11).
bool weekConverted(Iterable<Map<String, dynamic>> days, Speeds? speeds) =>
    days.any((d) => d['is_rest'] != true && d['main_set'] is String && mainSetInKm(d['main_set'] as String, speeds) != d['main_set']);

/// Aclaración debajo de la semana: de dónde salen los km convertidos o, si el plan ya viene en km,
/// qué significan el porcentaje y el RPE de cada tramo.
String kmNoteText({required bool converted, String? testDateLabel}) {
  if (!converted) {
    return testDateLabel != null
        ? 'Ritmos calculados con tu test del $testDateLabel (100 %).'
        : 'Cada tramo indica su porcentaje del ritmo de tu test (100 %) y su RPE. '
              'Cargá tu test en la Calculadora (web) para ver el ritmo por km de cada tramo.';
  }
  return testDateLabel != null
      ? 'Distancias calculadas con tu test del $testDateLabel.'
      : 'Distancias estimadas para el nivel del plan. Cargá tu test en la Calculadora (web) para ajustarlas a tu ritmo.';
}
