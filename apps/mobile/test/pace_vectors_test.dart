import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/pace.dart';

/// Ejecuta los MISMOS vectores que el motor TypeScript para garantizar paridad de cálculos.
void main() {
  final file = File('../../packages/training-engine/test-vectors/calculations.json');
  final vectors = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;

  group('ritmo y velocidad', () {
    for (final v in (vectors['pace'] as List).cast<Map<String, dynamic>>()) {
      test('${v['distanceM']} m en ${v['durationS']} s', () {
        final pace = paceSecondsPerKm(v['distanceM'] as num, v['durationS'] as num);
        final speed = speedKmh(v['distanceM'] as num, v['durationS'] as num);
        if (v['paceSPerKm'] == null) {
          expect(pace, isNull);
        } else {
          expect(pace, closeTo(v['paceSPerKm'] as num, 1e-5));
        }
        if (v['speedKmh'] == null) {
          expect(speed, isNull);
        } else {
          expect(speed, closeTo(v['speedKmh'] as num, 1e-5));
        }
        expect(formatPace(pace), v['paceLabel']);
      });
    }
  });

  group('duraciones', () {
    for (final v in (vectors['parseDuration'] as List).cast<Map<String, dynamic>>()) {
      test('parsea "${v['input']}"', () => expect(parseDuration(v['input'] as String), v['seconds']));
    }
    for (final v in (vectors['formatDuration'] as List).cast<Map<String, dynamic>>()) {
      test('formatea ${v['seconds']}', () => expect(formatDuration(v['seconds'] as num), v['label']));
    }
  });

  group('kilómetros', () {
    for (final v in (vectors['kmInput'] as List).cast<Map<String, dynamic>>()) {
      test('"${v['input']}"', () => expect(kmInputToMeters(v['input'] as String), v['meters']));
    }
  });

  group('parciales', () {
    for (final v in (vectors['splits'] as List).cast<Map<String, dynamic>>()) {
      test('${v['distanceM']} m / ${v['splitM']} m', () {
        expect(
          evenSplitsCumulative(v['distanceM'] as num, v['targetTimeS'] as num, v['splitM'] as num),
          (v['cumulative'] as List).cast<int>(),
        );
      });
    }
  });
}
