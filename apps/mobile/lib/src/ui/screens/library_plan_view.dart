import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../domain/distance_text.dart';
import '../../domain/plan_schedule.dart';
import '../../theme.dart';
import '../plan_widgets.dart';
import '../widgets.dart';

class _WeekData {
  _WeekData(this.days, this.done, this.ratings);
  final List<Map<String, dynamic>> days;
  final Set<String> done;
  final List<Map<String, dynamic>> ratings;
}

/// "Mi plan" (igual que la web): tira de semanas, "Semana N de T", solo los días de entrenamiento
/// numerados (Día 1, Día 2…) con sus pasos y "¿Cómo te fue?", y el historial de valoraciones.
class LibraryPlanView extends StatefulWidget {
  const LibraryPlanView({super.key, required this.repo, required this.plan, required this.onRefresh});
  final Repository repo;
  final EnrolledPlan plan;
  final Future<void> Function() onRefresh;

  @override
  State<LibraryPlanView> createState() => _LibraryPlanViewState();
}

class _LibraryPlanViewState extends State<LibraryPlanView> {
  late final String _today = isoDate(DateTime.now());
  late final String _thisMonday = mondayOf(_today);
  late final List<ScheduledWeek> _weeks = widget.plan.weeks;
  late String _selected = _initialWeek();
  late Future<_WeekData> _future = _load();

  String _initialWeek() {
    if (_weeks.any((w) => w.weekStart == _thisMonday)) return _thisMonday;
    if (_weeks.isEmpty) return widget.plan.enrollment['start_date'] as String;
    return _thisMonday.compareTo(_weeks.first.weekStart) < 0 ? _weeks.first.weekStart : _weeks.last.weekStart;
  }

  ScheduledWeek? get _week => _weeks.where((w) => w.weekStart == _selected).firstOrNull;

  Future<_WeekData> _load() async {
    final w = _week;
    final p = widget.plan;
    final results = await Future.wait([
      w?.planWeek == null ? Future.value(<Map<String, dynamic>>[]) : widget.repo.planWeekDays(p, w!.planWeek!),
      widget.repo.doneDates(p, _selected, addDays(_selected, 6)),
      widget.repo.ratings(p),
    ]);
    return _WeekData(results[0] as List<Map<String, dynamic>>, results[1] as Set<String>, results[2] as List<Map<String, dynamic>>);
  }

  void _select(String weekStart) => setState(() {
    _selected = weekStart;
    _future = _load();
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final p = widget.plan;
    final plan = p.plan;
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      child: FutureBuilder<_WeekData>(
        future: _future,
        builder: (context, snap) {
          final week = _week;
          final header = <Widget>[
            Text(
              plan['title'] as String,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: c.ink, height: 1.15),
            ),
            const SizedBox(height: 4),
            Text(
              '${plan['distance_label']} · ${plan['level']} · ${plan['duration_label']} · ${plan['days_per_week']} días por semana',
              style: TextStyle(color: c.muted),
            ),
            if (p.paused) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.warningBg, borderRadius: BorderRadius.circular(12)),
                child: Text('Tu plan está en pausa. Retomalo desde la sección Hoy de la web cuando te sientas bien.', style: TextStyle(color: c.warning)),
              ),
            ],
            const SizedBox(height: 16),
            WeekStrip(
              weeks: _weeks,
              selected: _selected,
              current: _thisMonday,
              isLocked: (w) => w.planWeek != null && !p.openWeeks.contains(w.planWeek),
              onSelect: _select,
            ),
            const SizedBox(height: 16),
            Text(
              week == null ? 'Plan terminado' : (week.planWeek == null ? 'Semana en pausa' : 'Semana ${week.planWeek} de ${p.durationWeeks}'),
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.ink),
            ),
            Text('${shortDate(_selected)} – ${shortDate(addDays(_selected, 6))}', style: TextStyle(color: c.muted)),
            const SizedBox(height: 12),
          ];
          if (snap.connectionState != ConnectionState.done) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...header,
                const Center(
                  child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()),
                ),
              ],
            );
          }
          if (snap.hasError) {
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ...header,
                ErrorView(message: 'No pudimos cargar la semana.', onRetry: () => _select(_selected)),
              ],
            );
          }
          final data = snap.data!;
          final dated = data.days.map((d) => (day: d, date: p.dateOf(_selected, d['day_index'] as int))).toList()..sort((a, b) => a.date.compareTo(b.date));
          final sessions = dated.where((x) => x.day['is_rest'] != true).toList();
          final ratingByDate = {for (final r in data.ratings) r['workout_date'] as String: r};
          final totalMin = sessions.fold<num>(0, (a, x) => a + ((x.day['duration_min_est'] as num?) ?? 0));
          final firstOpen =
              sessions.where((x) => x.date == _today).firstOrNull ?? sessions.where((x) => x.date.compareTo(_today) >= 0).firstOrNull ?? sessions.firstOrNull;
          final avg = data.ratings.isEmpty ? null : data.ratings.fold<num>(0, (a, r) => a + (r['rating'] as int)) / data.ratings.length;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...header,
              if (week?.planWeek != null && data.days.length == 7) ...[
                Text(
                  '${sessions.length} ${sessions.length == 1 ? 'entrenamiento' : 'entrenamientos'} · ${formatPlanMinutes(totalMin, round: true)}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: c.muted),
                ),
                if (p.speeds != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    kmNoteText(converted: weekConverted(data.days, p.speeds), testDateLabel: p.testDate == null ? null : shortDate(p.testDate!)),
                    style: TextStyle(fontSize: 12, color: c.muted),
                  ),
                ],
                const SizedBox(height: 12),
                for (var i = 0; i < sessions.length; i++) ...[
                  WorkoutCard(
                    key: ValueKey('${_selected}_${sessions[i].date}'),
                    day: sessions[i].day,
                    n: i + 1,
                    date: sessions[i].date,
                    today: sessions[i].date == _today,
                    done: data.done.contains(sessions[i].date),
                    rating: ratingByDate[sessions[i].date]?['rating'] as int?,
                    note: ratingByDate[sessions[i].date]?['note'] as String?,
                    initiallyExpanded: identical(sessions[i], firstOpen),
                    speeds: p.speeds,
                    test: p.paceTest,
                    onRate: sessions[i].date.compareTo(_today) <= 0
                        ? (rating, note) async {
                            await widget.repo.saveRating(
                              p,
                              date: sessions[i].date,
                              planWeek: week!.planWeek!,
                              dayIndex: sessions[i].day['day_index'] as int,
                              rating: rating,
                              note: note,
                            );
                            final ratings = await widget.repo.ratings(p);
                            if (mounted) setState(() => _future = Future.value(_WeekData(data.days, data.done, ratings)));
                          }
                        : null,
                  ),
                  const SizedBox(height: 10),
                ],
              ] else if (week?.planWeek != null)
                SectionCard(
                  title: 'Se libera con la suscripción',
                  child: const Text(
                    'La muestra del plan es gratis. Con la suscripción mensual, cada débito automático libera el mes siguiente del plan (4 semanas). Podés suscribirte desde la web.',
                  ),
                ),
              const SizedBox(height: 8),
              SectionCard(
                title: 'Tus valoraciones',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      avg == null
                          ? 'Todavía no valoraste entrenamientos. Abrí un entrenamiento hecho y contá cómo te fue.'
                          : 'Promedio: ${avg.toStringAsFixed(1).replaceAll('.', ',')} de 5 · ${data.ratings.length} ${data.ratings.length == 1 ? 'entrenamiento valorado' : 'entrenamientos valorados'}',
                      style: TextStyle(color: c.muted),
                    ),
                    for (final r in data.ratings)
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(ratingEmoji[r['rating']] ?? '', style: const TextStyle(fontSize: 24)),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text.rich(
                                    TextSpan(
                                      children: [
                                        TextSpan(
                                          text:
                                              'Semana ${r['plan_week']}'
                                              '${p.trainingDayNumber(r['plan_week'] as int, r['plan_day_index'] as int) == null ? '' : ' · Día ${p.trainingDayNumber(r['plan_week'] as int, r['plan_day_index'] as int)}'}',
                                          style: TextStyle(fontWeight: FontWeight.w700, color: c.ink),
                                        ),
                                        TextSpan(
                                          text: ' · ${shortDate(r['workout_date'] as String)}',
                                          style: TextStyle(color: c.muted),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(ratingLabels[r['rating']] ?? '', style: TextStyle(color: c.ink)),
                                  if (r['note'] != null) Text('“${r['note']}”', style: TextStyle(color: c.muted)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
