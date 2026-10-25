import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/effort.dart';
import 'package:runner360/src/domain/session_blocks.dart';

void main() {
  test('la escala es la misma que la de la web (packages/plan-library/src/rpe-scale.json)', () {
    final json = jsonDecode(File('../../packages/plan-library/src/rpe-scale.json').readAsStringSync()) as Map<String, dynamic>;
    final bands = (json['bands'] as List).cast<Map<String, dynamic>>();
    expect(bands.length, rpeBands.length);
    for (var i = 0; i < bands.length; i++) {
      expect((maxPct: bands[i]['maxPct'], rpe: bands[i]['rpe'], level: bands[i]['level']), rpeBands[i]);
    }
  });

  test('porcentaje → RPE según la tabla', () {
    const cases = {50: 2, 60: 3, 65: 3, 66: 4, 70: 4, 75: 5, 76: 6, 85: 7, 86: 8, 95: 8, 96: 9, 100: 9, 101: 10, 115: 10};
    cases.forEach((pct, rpe) => expect(rpeFor(pct), rpe, reason: '$pct %'));
    expect(effortLabel(75), '75 % · RPE 5');
    expect(rpeTable().first, (range: '50–57 %', rpe: 2));
    expect(rpeTable().last, (range: 'más de 100 %', rpe: 10));
  });

  test('ritmo por km según el test', () {
    const t = (meters: 5000, seconds: 1500);
    expect(paceForPct(t, 100), 300);
    expect(paceForPct(t, 75), 400);
  });

  test('bloques: tramos, pausas, total y color', () {
    final w = parseBlock('15 min al 70 % + 5 min de movilidad + 4 × 100 m al 115 %, pausa 40 s', BlockKind.warmup);
    expect(w.lines, const [
      SessionLine(what: '15 min', pct: 70),
      SessionLine(what: '5 min de movilidad'),
      SessionLine(what: '4 × 100 m', pct: 115, recovery: 'Pausa 40 s'),
    ]);
    expect(w.colorPct, 70);
    final m = parseBlock('15,5 km: 6,5 km al 70 % + 3 × 1000 m al 95 %, pausa 2 min trotando + 6 km al 70 %', BlockKind.main);
    expect(m.total, '15,5 km');
    expect(m.lines.map((l) => l.what), ['6,5 km', '3 × 1000 m', '6 km']);
    expect(m.colorPct, 95);
    expect(parseSegment('11 km al 70 % (sin pausas)'), const SessionLine(what: '11 km', pct: 70, note: 'Sin pausas'));
    expect(parseBlock("4 × 1500 m en Umbral (100 %), pausa 2' de trote suave", BlockKind.main).lines.single.pct, isNull);
  });
}
