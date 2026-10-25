import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/format.dart';

void main() {
  test('nombres de sesiones sin nombres de esfuerzo (igual que la web)', () {
    expect(sessionTypeLabels['easy_run'], 'Carrera continua');
    expect(sessionTypeLabels.values.join(' '), isNot(matches(RegExp('rodaje|tempo|umbral|suave|recuperaci', caseSensitive: false))));
    expect(sessionTitle('Rodaje fácil'), 'Carrera continua');
    expect(sessionTitle('Rodaje largo'), 'Carrera continua larga');
    expect(sessionTitle('Intervalos'), 'Intervalos');
  });
}
