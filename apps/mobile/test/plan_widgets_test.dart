import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/data/repository.dart';
import 'package:runner360/src/domain/plan_schedule.dart';
import 'package:runner360/src/theme.dart';
import 'package:runner360/src/ui/plan_widgets.dart';

const day = {
  'day_index': 1,
  'is_rest': false,
  'session_type': 'Pasadas',
  'short_label': '4 × 1500 m',
  'category': 'thr',
  'warmup': '12 min al 70 % + 3 min de movilidad + 3 × 100 m al 115 %, pausa 40 s',
  'main_set': '4 × 1500 m al 90 %, pausa 2 min trotando',
  'cooldown': '8 min al 60 % + 4 min de estiramientos',
  'duration_min_est': 58,
  'distance_km_est': 8.5,
  'intensity': '60–115 %',
  'strength_after': true,
};

Widget _app(Widget child, {ThemeMode mode = ThemeMode.light}) => MaterialApp(
  theme: buildLightTheme(),
  darkTheme: buildDarkTheme(),
  themeMode: mode,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets('tarjeta del entrenamiento: día, km y duración; tres bloques con porcentaje y RPE', (tester) async {
    await tester.pumpWidget(_app(const WorkoutCard(day: day, n: 2, date: '2026-10-06', today: false, initiallyExpanded: true)));
    expect(find.text('DÍA'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text("8,5 km · 58'"), findsOneWidget);
    for (final s in ['1. ENTRADA EN CALOR', '2. PARTE PRINCIPAL', '3. VUELTA A LA CALMA']) {
      expect(find.text(s), findsOneWidget);
    }
    expect(find.text('4 × 1500 m'), findsOneWidget);
    expect(find.text('90 % · RPE 8'), findsOneWidget);
    expect(find.text('Pausa 2 min trotando'), findsOneWidget);
    expect(find.text('3 × 100 m'), findsOneWidget);
    expect(find.text('115 % · RPE 10'), findsOneWidget);
    expect(find.text('Pausa 40 s'), findsOneWidget);
    expect(find.text('4 min de estiramientos'), findsOneWidget);
    // Sin test cargado no hay ritmo; sin nombres de esfuerzo ni el tipo de sesión.
    expect(find.textContaining('Ritmo'), findsNothing);
    expect(find.textContaining('Umbral'), findsNothing);
    expect(find.text('Pasadas'), findsNothing);
    expect(find.text('Después: rutina de fuerza', findRichText: true), findsOneWidget);
    // Sin onRate (día futuro) no se puede valorar todavía.
    expect(find.text('Vas a poder valorarlo el día del entrenamiento.'), findsOneWidget);
  });

  testWidgets('con test cargado: ritmo por km de cada tramo', (tester) async {
    await tester.pumpWidget(
      _app(const WorkoutCard(day: day, n: 1, date: '2026-10-06', today: false, initiallyExpanded: true, test: (meters: 5000, seconds: 1500))),
    );
    expect(find.text('Ritmo 5:33 /km'), findsOneWidget); // 300 s / 0,90
    expect(find.text('Ritmo 4:21 /km'), findsOneWidget); // 300 s / 1,15
  });

  testWidgets('ayuda del RPE: cerrada no ocupa lugar y se abre con un toque', (tester) async {
    await tester.pumpWidget(_app(const WorkoutCard(day: day, n: 1, date: '2026-10-06', today: false, initiallyExpanded: true), mode: ThemeMode.dark));
    expect(find.textContaining('esfuerzo que sentís'), findsNothing);
    await tester.tap(find.text('¿Qué es el RPE?'));
    await tester.pump();
    expect(find.textContaining('esfuerzo que sentís'), findsOneWidget);
    expect(find.text('más de 100 %'), findsOneWidget);
  });

  testWidgets('contenido anterior (sin porcentajes): la parte principal se muestra tal cual', (tester) async {
    final old = <String, dynamic>{...day, 'warmup': null, 'cooldown': null}..['main_set'] = '8 km continuos';
    await tester.pumpWidget(_app(WorkoutCard(day: old, n: 1, date: '2026-10-06', today: false, initiallyExpanded: true)));
    expect(find.text('1. PARTE PRINCIPAL'), findsOneWidget);
    expect(find.text('8 km continuos'), findsOneWidget);
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
