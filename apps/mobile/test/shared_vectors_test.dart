import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:runner360/core/format.dart';
import 'package:runner360/core/metrics.dart';

/// Usa los MISMOS vectores que la suite Vitest de packages/training-engine para garantizar
/// que web y mobile calculan igual.
void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));
  final vectors = jsonDecode(File('../../packages/training-engine/fixtures/pace-vectors.json').readAsStringSync()) as Map<String, dynamic>;

  group('ritmo y velocidad', () {
    for (final v in (vectors['pace'] as List).cast<Map<String, dynamic>>()) {
      test('${v['distanceM']} m en ${v['durationS']} s', () {
        final pace = paceSecondsPerKm(v['distanceM'] as int, v['durationS'] as int);
        final speed = speedKmh(v['distanceM'] as int, v['durationS'] as int);
        if (v['paceSPerKm'] == null) {
          expect(pace, isNull);
          expect(speed, isNull);
        } else {
          expect(pace, closeTo((v['paceSPerKm'] as num).toDouble(), 1e-9));
          expect(speed, closeTo((v['speedKmh'] as num).toDouble(), 1e-9));
        }
        expect(formatPace(pace), v['formattedPace']);
      });
    }
  });

  test('formato de duración', () {
    for (final v in (vectors['duration'] as List).cast<Map<String, dynamic>>()) {
      expect(formatDuration(v['seconds'] as int), v['formatted']);
    }
  });

  test('parseo de km sin punto flotante', () {
    for (final v in (vectors['parseKm'] as List).cast<Map<String, dynamic>>()) {
      expect(parseKmToMeters(v['input'] as String), v['meters'], reason: v['input'] as String);
    }
  });

  test('parseo de duración', () {
    for (final v in (vectors['parseDuration'] as List).cast<Map<String, dynamic>>()) {
      expect(parseDuration(v['input'] as String), v['seconds'], reason: v['input'] as String);
    }
  });

  test('formato de km es-AR', () {
    expect(formatKm(10500), '10,5 km');
    expect(formatKm(21097), '21,1 km');
    expect(formatKm(5000), '5 km');
  });

  test('totales semanales ignoran sesiones no realizadas', () {
    final w = weeklyTotals([
      (startedAt: DateTime(2026, 9, 28, 10), distanceM: 5000, durationS: 1800, status: 'completed'),
      (startedAt: DateTime(2026, 10, 1, 10), distanceM: 7000, durationS: 2400, status: 'modified'),
      (startedAt: DateTime(2026, 10, 2, 10), distanceM: 0, durationS: 0, status: 'skipped'),
      (startedAt: DateTime(2026, 10, 6, 10), distanceM: 3000, durationS: 1000, status: 'completed'),
    ]);
    expect(w.map((e) => e.key).toList(), ['2026-09-28', '2026-10-05']);
    expect(w.first.distanceM, 12000);
    expect(w.first.workouts, 2);
  });
}
