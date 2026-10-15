import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/theme.dart';
import 'package:runner360/src/theme_controller.dart';
import 'package:runner360/src/ui/screens/profile_screen.dart';
import 'package:runner360/src/ui/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('el tema por defecto es claro y la elección se recuerda', () async {
    final c = ThemeController();
    await c.load();
    expect(c.value, ThemeMode.light);
    await c.set(ThemeMode.dark);
    final again = ThemeController();
    await again.load();
    expect(again.value, ThemeMode.dark);
  });

  test('los temas usan la paleta de la marca', () {
    expect(buildLightTheme().extension<R360Colors>()!.canvas, const Color(0xFFF5F7FA));
    expect(buildDarkTheme().extension<R360Colors>()!.canvas, const Color(0xFF101820));
    expect(buildDarkTheme().brightness, Brightness.dark);
  });

  testWidgets('las tarjetas toman los colores del tema oscuro', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLightTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: ThemeMode.dark,
        home: const Scaffold(
          body: SectionCard(title: 'Título', child: Text('Contenido')),
        ),
      ),
    );
    final card = tester.widget<Card>(find.byType(Card));
    expect(card.color, R360Colors.dark.surface);
    final title = tester.widget<Text>(find.text('Título'));
    expect(title.style?.color, R360Colors.dark.ink);
  });

  testWidgets('el selector de Apariencia cambia el tema', (tester) async {
    await themeController.set(ThemeMode.light);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildLightTheme(),
        home: const Scaffold(body: ThemeSelector()),
      ),
    );
    await tester.tap(find.text('Oscuro'));
    await tester.pumpAndSettle();
    expect(themeController.value, ThemeMode.dark);
  });
}
