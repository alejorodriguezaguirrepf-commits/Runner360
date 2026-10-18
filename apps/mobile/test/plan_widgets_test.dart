import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/data/repository.dart';
import 'package:runner360/src/domain/plan_schedule.dart';
import 'package:runner360/src/theme.dart';
import 'package:runner360/src/ui/plan_widgets.dart';

const day = {
  'day_index': 1,
  'is_rest': false,
  'session_type': 'Umbral fraccionado',
  'category': 'thr',
  'warmup': "12' Suave",
  'main_set': "3 × 8' en Umbral",
  'cooldown': "8' trote muy suave",
  'duration_min_est': 58,
  'distance_km_est': 8.5,
  'intensity': 'Umbral (RPE 6–7)',
  'strength_after': true,
};

Widget _app(Widget child, {ThemeMode mode = ThemeMode.light}) => MaterialApp(
  theme: buildLightTheme(),
  darkTheme: buildDarkTheme(),
  themeMode: mode,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets('tarjeta del entrenamiento: Día N, métricas y pasos', (tester) async {
    await tester.pumpWidget(_app(const WorkoutCard(day: day, n: 2, date: '2026-10-06', today: false, initiallyExpanded: true)));
    expect(find.text('DÍA'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('Umbral fraccionado'), findsOneWidget);
    expect(find.text("58'"), findsOneWidget);
    expect(find.text('· 8,5 km'), findsOneWidget);
    expect(find.text('Umbral'), findsOneWidget);
    for (final s in ['CALENTAMIENTO', 'PRINCIPAL', 'VUELTA A LA CALMA', 'DESPUÉS']) {
      expect(find.text(s), findsOneWidget);
    }
    // Sin onRate (día futuro) no se puede valorar todavía.
    expect(find.text('Vas a poder valorarlo el día del entrenamiento.'), findsOneWidget);
  });

  testWidgets('¿Cómo te fue?: exige elegir y guarda la valoración', (tester) async {
    int? saved;
    String? savedNote;
    await tester.pumpWidget(
      _app(
        WorkoutCard(
          day: day,
          n: 1,
          date: '2026-10-06',
          today: true,
          initiallyExpanded: true,
          onRate: (r, note) async {
            saved = r;
            savedNote = note;
          },
        ),
        mode: ThemeMode.dark,
      ),
    );
    expect(find.text('Hoy · ${shortDate('2026-10-06')}'), findsOneWidget);
    await tester.ensureVisible(find.text('Guardar valoración'));
    await tester.tap(find.text('Guardar valoración'));
    await tester.pump();
    expect(find.text('Elegí cómo te fue.'), findsOneWidget);
    await tester.tap(find.text('Bien'));
    await tester.enterText(find.byType(TextField), 'Piernas livianas');
    await tester.ensureVisible(find.text('Guardar valoración'));
    await tester.tap(find.text('Guardar valoración'));
    await tester.pumpAndSettle();
    expect(saved, 4);
    expect(savedNote, 'Piernas livianas');
    expect(find.text('Valoración guardada.'), findsOneWidget);
  });

  testWidgets('tira de semanas: elegida, bloqueadas y selección', (tester) async {
    String? picked;
    final weeks = [const ScheduledWeek('2026-10-05', 1), const ScheduledWeek('2026-10-12', 2), const ScheduledWeek('2026-10-19', 3)];
    await tester.pumpWidget(
      _app(WeekStrip(weeks: weeks, selected: '2026-10-05', current: '2026-10-12', isLocked: (w) => w.planWeek == 3, onSelect: (w) => picked = w)),
    );
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    await tester.tap(find.text('2'));
    expect(picked, '2026-10-12');
  });

  testWidgets('admin: con todas las semanas liberadas por la base, la tira no muestra candados', (tester) async {
    // La base (RLS) le devuelve al admin los días de las 12 semanas: así arma la app las semanas abiertas.
    final plan = EnrolledPlan(
      enrollment: {'id': 'e', 'content_version': '2026.10.1', 'plan_id': 'plan-07', 'start_date': '2026-10-05', 'status': 'active', 'day_map': [0, 1, 2, 3, 4, 5, 6]},
      plan: {'duration_weeks': 12},
      segments: segmentsOf('2026-10-05', []),
      trainingDays: {for (var w = 1; w <= 12; w++) w: [1, 3, 6]},
    );
    expect(plan.openWeeks.length, 12);
    await tester.pumpWidget(
      _app(
        WeekStrip(
          weeks: plan.weeks,
          selected: '2026-10-05',
          current: '2026-10-05',
          isLocked: (w) => w.planWeek != null && !plan.openWeeks.contains(w.planWeek),
          onSelect: (_) {},
        ),
      ),
    );
    expect(find.byIcon(Icons.lock_outline), findsNothing);
  });
}
