import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/main.dart';

void main() {
  testWidgets('sin credenciales muestra configuración pendiente (no simula conexión)', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: ConfigPendingScreen()));
    expect(find.text('Configuración pendiente'), findsOneWidget);
    expect(find.text('Entrená. Medí. Progresá.'), findsOneWidget);
  });
}
