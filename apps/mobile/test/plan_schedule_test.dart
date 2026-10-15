import 'package:flutter_test/flutter_test.dart';
import 'package:runner360/src/domain/plan_schedule.dart';

void main() {
  const start = '2026-10-05'; // lunes

  test('fechas: lunes = 0, lunes de la semana y sumas de días', () {
    expect(weekdayOf('2026-10-05'), 0);
    expect(weekdayOf('2026-10-11'), 6);
    expect(mondayOf('2026-10-15'), '2026-10-12');
    expect(addDays('2026-10-30', 3), '2026-11-02');
    expect(daysBetween('2026-10-05', '2026-10-19'), 14);
  });

  test('sin check-ins: una semana del plan por semana de calendario', () {
    final segs = segmentsOf(start, []);
    expect(planWeekAt(segs, '2026-10-05', 12)!.week, 1);
    expect(planWeekAt(segs, '2026-10-19', 12)!.week, 3);
    expect(planWeekAt(segs, '2026-09-28', 12), isNull);
    expect(planWeekAt(segs, addDays(start, 12 * 7), 12), isNull);
    expect(scheduledWeeks(segs, 12).length, 12);
  });

  test('repetir una semana desplaza el resto (igual que la web)', () {
    final segs = segmentsOf(start, [
      {'week_start': '2026-10-05', 'decision': 'repeat', 'next_week_start': '2026-10-12', 'next_plan_week': 1, 'created_at': 'a'},
    ]);
    expect(planWeekAt(segs, '2026-10-12', 12)!.week, 1);
    expect(planWeekAt(segs, '2026-10-19', 12)!.week, 2);
    final weeks = scheduledWeeks(segs, 12);
    expect(weeks.length, 13);
    expect(weeks.where((w) => w.planWeek == 1).length, 2);
  });

  test('pausa desde su semana y retomar', () {
    final segs = segmentsOf(start, [
      {'week_start': '2026-10-12', 'decision': 'pause', 'next_week_start': null, 'next_plan_week': null, 'created_at': 'a'},
      {'week_start': '2026-10-19', 'decision': 'resume', 'next_week_start': '2026-10-26', 'next_plan_week': 2, 'created_at': 'b'},
    ]);
    expect(planWeekAt(segs, '2026-10-12', 12)!.isPause, isTrue);
    expect(planWeekAt(segs, '2026-10-19', 12)!.isPause, isTrue);
    expect(planWeekAt(segs, '2026-10-26', 12)!.week, 2);
  });

  test('formatos como la web', () {
    expect(formatPlanMinutes(41), "41'");
    expect(formatPlanMinutes(76), "1 h 16'");
    expect(formatPlanMinutes(37.5), "37' 30\"");
    expect(formatPlanMinutes(215.6, round: true), "3 h 36'");
    expect(formatKm1(5.38), '5,4 km');
    expect(shortDate('2026-10-19'), '19 oct');
  });
}
