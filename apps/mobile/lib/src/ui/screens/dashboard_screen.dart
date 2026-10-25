import 'package:flutter/material.dart';

import '../../config.dart';
import '../../data/repository.dart';
import '../../domain/effort.dart';
import '../../domain/format.dart';
import '../../domain/plan_schedule.dart';
import '../../domain/session_blocks.dart';
import '../../theme.dart';
import '../widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.repo, required this.onRegister, required this.onOpenPlan});
  final Repository repo;
  final VoidCallback onRegister;
  final VoidCallback onOpenPlan;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

/// Datos del plan de la biblioteca para el Inicio: hoy, la semana y la próxima sesión.
class _PlanToday {
  _PlanToday(this.plan, this.planWeek, this.sessions, this.done, this.next, this.nextN);
  final EnrolledPlan plan;
  final PlanWeek? planWeek;

  /// Entrenamientos de esta semana (día + fecha), ordenados por fecha.
  final List<({Map<String, dynamic> day, String date})> sessions;
  final Set<String> done;
  final ({Map<String, dynamic> day, String date})? next;
  final int nextN;
}

class _DashboardData {
  _DashboardData(this.profile, this.library, this.legacyPlan, this.legacyCalendar, this.workouts);
  final Map<String, dynamic>? profile;
  final _PlanToday? library;
  final Map<String, dynamic>? legacyPlan;
  final List<Map<String, dynamic>> legacyCalendar;
  final List<Map<String, dynamic>> workouts;
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<_DashboardData> _future = _load();

  Future<_PlanToday> _planToday(EnrolledPlan p, String today) async {
    final monday = mondayOf(today);
    final pw = planWeekAt(p.segments, monday, p.durationWeeks);
    Future<List<({Map<String, dynamic> day, String date})>> sessionsOf(String weekStart, PlanWeek? w) async {
      if (w?.week == null || p.paused) return [];
      final days = await widget.repo.planWeekDays(p, w!.week!);
      return days.where((d) => d['is_rest'] != true).map((d) => (day: d, date: p.dateOf(weekStart, d['day_index'] as int))).toList()
        ..sort((a, b) => a.date.compareTo(b.date));
    }

    final sessions = await sessionsOf(monday, pw);
    final done = await widget.repo.doneDates(p, monday, addDays(monday, 6));
    var next = sessions.where((x) => x.date.compareTo(today) > 0).firstOrNull;
    var nextN = next == null ? 0 : sessions.indexOf(next) + 1;
    if (next == null && !p.paused) {
      final following = addDays(monday, 7);
      final s = await sessionsOf(following, planWeekAt(p.segments, following, p.durationWeeks));
      next = s.firstOrNull;
      nextN = next == null ? 0 : 1;
    }
    return _PlanToday(p, pw, sessions, done, next, nextN);
  }

  Future<_DashboardData> _load() async {
    final today = isoDate(DateTime.now());
    final profile = await widget.repo.profile();
    final enrolled = await widget.repo.enrolledPlan();
    final library = enrolled == null ? null : await _planToday(enrolled, today);
    // Plan DEMO del sistema anterior: solo para quien todavía tenga uno activo.
    final legacy = enrolled == null ? await widget.repo.activePlan() : null;
    final calendar = legacy == null ? <Map<String, dynamic>>[] : await widget.repo.calendar(legacy['id'] as String);
    final workouts = await widget.repo.workoutsSince(mondayOf(today));
    return _DashboardData(profile, library, legacy, calendar, workouts);
  }

  Widget _metric(BuildContext context, String label, String value) => Expanded(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 14, color: context.colors.navMuted)),
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: context.colors.navInk),
        ),
      ],
    ),
  );

  List<Widget> _libraryCards(BuildContext context, _PlanToday t, String today) {
    final c = context.colors;
    final p = t.plan;
    final todaySession = t.sessions.where((x) => x.date == today).firstOrNull;
    final n = todaySession == null ? 0 : t.sessions.indexOf(todaySession) + 1;
    final plannedMin = t.sessions.fold<num>(0, (a, x) => a + ((x.day['duration_min_est'] as num?) ?? 0));
    final doneSessions = t.sessions.where((x) => t.done.contains(x.date)).toList();
    final doneMin = doneSessions.fold<num>(0, (a, x) => a + ((x.day['duration_min_est'] as num?) ?? 0));
    final startDate = p.enrollment['start_date'] as String;

    String status() {
      if (p.paused || (t.planWeek?.isPause ?? false)) return 'Tu plan está en pausa.';
      if (t.planWeek == null) return today.compareTo(startDate) < 0 ? 'Tu plan empieza el ${shortDate(startDate)}.' : 'Terminaste el plan.';
      if (!p.openWeeks.contains(t.planWeek!.week)) return 'Esta semana se libera con la suscripción mensual.';
      return 'El descanso también es parte del plan.';
    }

    return [
      SectionCard(
        title: 'Entrenamiento de hoy',
        dark: true,
        child: todaySession != null
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    (todaySession.day['short_label'] ?? todaySession.day['session_type'] ?? '') as String,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.navInk),
                  ),
                  Text('Día $n · Semana ${t.planWeek!.week} de ${p.durationWeeks}', style: TextStyle(color: c.navMuted)),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _metric(context, 'Duración', formatPlanMinutes(todaySession.day['duration_min_est'] as num?)),
                      _metric(context, 'Distancia', formatKm1(todaySession.day['distance_km_est'] as num?)),
                      _metric(context, 'Intensidad', mainPct(todaySession.day) == null ? '—' : effortLabel(mainPct(todaySession.day)!)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: widget.onOpenPlan, child: const Text('Ver entrenamiento')),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    t.sessions.isNotEmpty || (t.planWeek?.week != null && p.openWeeks.contains(t.planWeek!.week)) ? 'Hoy descansás' : p.plan['title'] as String,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c.navInk),
                  ),
                  const SizedBox(height: 4),
                  Text(status(), style: TextStyle(color: c.navMuted)),
                  const SizedBox(height: 16),
                  FilledButton(onPressed: widget.onOpenPlan, child: const Text('Ver mi plan')),
                ],
              ),
      ),
      if (t.planWeek?.week != null && t.sessions.isNotEmpty) ...[
        const SizedBox(height: 16),
        SectionCard(
          title: 'Semana ${t.planWeek!.week} de ${p.durationWeeks}',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: '${doneSessions.length}',
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: c.ink),
                    ),
                    TextSpan(
                      text: ' / ${t.sessions.length} ${t.sessions.length == 1 ? 'entrenamiento' : 'entrenamientos'}',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: c.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: t.sessions.isEmpty ? 0 : doneSessions.length / t.sessions.length,
                  minHeight: 10,
                  backgroundColor: c.surface2,
                  color: Brand.teal,
                  semanticsLabel: 'Progreso de la semana',
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${formatPlanMinutes(doneMin, round: true)} de ${formatPlanMinutes(plannedMin, round: true)} planificados',
                style: TextStyle(color: c.muted),
              ),
            ],
          ),
        ),
      ],
      if (t.next != null) ...[
        const SizedBox(height: 16),
        SectionCard(
          title: 'Próxima sesión',
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: widget.onOpenPlan,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: c.line),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(16)),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'DÍA',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.muted, height: 1),
                        ),
                        Text(
                          '${t.nextN}',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.ink, height: 1.1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (t.next!.day['short_label'] ?? t.next!.day['session_type'] ?? '') as String,
                          style: TextStyle(fontWeight: FontWeight.w700, color: c.ink),
                        ),
                        Text(
                          '${shortDate(t.next!.date)} · ${formatPlanMinutes(t.next!.day['duration_min_est'] as num?)}'
                          '${t.next!.day['distance_km_est'] != null ? ' · ${formatKm1(t.next!.day['distance_km_est'] as num)}' : ''}',
                          style: TextStyle(color: c.muted),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: c.muted),
                ],
              ),
            ),
          ),
        ),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => setState(() => _future = _load()),
      child: FutureBuilder<_DashboardData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) return ErrorView(message: 'No pudimos cargar tu inicio.', onRetry: () => setState(() => _future = _load()));
          final d = snap.data!;
          final today = isoDate(DateTime.now());
          final legacyToday = d.legacyCalendar.where((c) => c['scheduled_date'] == today).toList();
          final weekDistance = d.workouts.where((w) => w['status'] != 'skipped').fold<int>(0, (a, w) => a + ((w['distance_m'] as int?) ?? 0));
          final version = d.legacyPlan?['version'] as Map<String, dynamic>?;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                'Hola, ${d.profile?['display_name'] ?? 'corredor'}',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: context.colors.ink),
              ),
              Text(formatDateLong(DateTime.now()), style: TextStyle(color: context.colors.muted)),
              const SizedBox(height: 16),
              if (d.profile?['onboarding_completed_at'] == null)
                const SectionCard(
                  title: 'Completá tu perfil de corredor',
                  child: Text('El cuestionario deportivo está disponible en la versión web. Pronto también en la app.'),
                )
              else if (d.library != null)
                ..._libraryCards(context, d.library!, today)
              else if (d.legacyPlan != null)
                SectionCard(
                  title: 'Entrenamiento de hoy',
                  dark: true,
                  trailing: version?['is_demo'] == true ? const DemoBadge() : null,
                  child: legacyToday.isEmpty
                      ? const Text('Hoy no hay sesión planificada.')
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            for (final s in legacyToday) ...[
                              Text(sessionTitle((s['session'] as Map)['title'] as String), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                              Text(
                                '${sessionTypeLabels[(s['session'] as Map)['session_type']]} · ${formatMinutesLong((s['session'] as Map)['duration_s'] as int?)}',
                              ),
                              Text(calendarStatusLabels[s['status']] ?? ''),
                            ],
                            const SizedBox(height: 12),
                            FilledButton(onPressed: widget.onRegister, child: const Text('Registrar sesión')),
                          ],
                        ),
                )
              else
                const SectionCard(
                  title: 'Todavía no tenés un plan',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Elegí la distancia, los días por semana y la duración en la web. Tu plan aparece acá automáticamente.'),
                      SizedBox(height: 8),
                      SelectableText('${AppConfig.siteHost}/planes', style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              const SizedBox(height: 16),
              SectionCard(
                title: 'Esta semana',
                child: Row(
                  children: [
                    Expanded(
                      child: StatTile(label: 'Distancia', value: formatKm(weekDistance)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: StatTile(label: 'Entrenamientos', value: '${d.workouts.where((w) => w['status'] != 'skipped').length}'),
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
