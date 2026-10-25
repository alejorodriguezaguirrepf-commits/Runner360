import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/distance_text.dart';

void main() {
  const ch2 = {'walk': 6.0, 'rec': 8.5, 'suave': 9.5, 'mod': 10.5, 'umb': 11.0, 'r10': 11.3, 'int': 11.8, 'vel': 13.0, 'test': 11.2};

  test('igual que la web: continuos, pasadas y tramos', () {
    expect(mainSetInKm("55' continuos en Suave", ch2), '8,5 km continuos en Suave');
    expect(mainSetInKm("3 × 8' en Umbral, pausa 2' de trote suave", ch2), "3 × 1,5 km en Umbral, pausa 2' de trote suave");
    expect(mainSetInKm("1h20': primeros 1h10' en Suave y últimos 10' en Moderado", ch2), '13 km: primeros 11 km en Suave y últimos 2 km en Moderado');
    expect(mainSetInKm("5 × 2' a ritmo de 10 km (Intenso), pausa 2' de trote suave", ch2), "5 × 400 m a ritmo de 10 km (Intenso), pausa 2' de trote suave");
  });

  test('deja en minutos tests, caminata y cuestas', () {
    for (final t in ["Test de 30' a la máxima intensidad sostenible (ritmo parejo)", "8 × (1' trote + 2' caminata)", '8 × 20" en subida (pendiente 4–6%)']) {
      expect(mainSetInKm(t, ch2), t);
    }
    expect(mainSetInKm("55' continuos en Suave", null), "55' continuos en Suave");
  });

  test('con test: 6 km en 30 min = 12 km/h', () {
    final s = runnerSpeeds(ch2, testKm: 6, testS: 1800);
    expect(s['suave'], closeTo(9.5 * 12 / 11.2, 1e-9));
    expect(s['walk'], 6.0);
    expect(mainSetInKm("55' continuos en Suave", s), '9,5 km continuos en Suave');
  });

  test('modelo del capítulo desde el contenido', () {
    expect(modelSpeeds({'chapter2_kmh': ch2}, 2)!['umb'], 11.0);
    expect(modelSpeeds({'note': 'x'}, 2), isNull);
  });

  test('contenido ya en km (2026.11): no se convierte y la nota explica el porcentaje', () {
    const km = "4 × 1500 m en Umbral (100 %), pausa 2' de trote suave";
    expect(mainSetInKm(km, ch2), km);
    expect(mainSetInKm('11 km continuos en Suave (85 %)', ch2), '11 km continuos en Suave (85 %)');
    final week = [
      {'is_rest': true},
      {'is_rest': false, 'main_set': km},
    ];
    expect(weekConverted(week, ch2), isFalse);
    expect(kmNoteText(converted: false), contains('porcentaje del ritmo de tu test (100 %) y su RPE'));
    expect(kmNoteText(converted: false, testDateLabel: '6 oct'), 'Ritmos calculados con tu test del 6 oct (100 %).');
    expect(weekConverted([{'is_rest': false, 'main_set': "55' continuos en Suave"}], ch2), isTrue);
    expect(kmNoteText(converted: true, testDateLabel: '6 oct'), 'Distancias calculadas con tu test del 6 oct.');
  });
}
