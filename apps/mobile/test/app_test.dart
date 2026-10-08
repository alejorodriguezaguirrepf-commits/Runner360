import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:runner360/main.dart';
import 'package:runner360/src/billing/store_billing.dart';
import 'package:runner360/src/ui/screens/auth_screen.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_AR'));

  testWidgets('sin credenciales muestra configuración pendiente (no simula conexión)', (tester) async {
    await tester.pumpWidget(const Runner360App());
    expect(find.text('Configuración pendiente'), findsOneWidget);
  });

  testWidgets('pantalla de ingreso en español con alta de cuenta', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: AuthScreen()));
    expect(find.text('Ingresá a tu cuenta'), findsOneWidget);
    await tester.tap(find.text('Crear cuenta'));
    await tester.pump();
    expect(find.text('Creá tu cuenta gratis'), findsOneWidget);
    expect(find.textContaining('Acepto los términos'), findsOneWidget);
  });

  test('las compras en la app no están disponibles hasta configurarlas', () async {
    final billing = UnconfiguredStoreBilling();
    expect(billing.isAvailable, isFalse);
    expect(await billing.loadProducts(), isEmpty);
    expect(() => billing.purchase('premium_monthly'), throwsUnsupportedError);
  });
}
