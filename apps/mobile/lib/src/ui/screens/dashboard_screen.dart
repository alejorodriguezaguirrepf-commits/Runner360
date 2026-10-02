import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../domain/format.dart';
import '../../theme.dart';
import '../widgets.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.repo, required this.onRegister});
  final Repository repo;
  final VoidCallback onRegister;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardData {
  _DashboardData(this.profile, this.plan, this.calendar, this.workouts);
  final Map<String, dynamic>? profile;
  final Map<String, dynamic>? plan;
  final List<Map<String, dynamic>> calendar;
  final List<Map<String, dynamic>> workouts;
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<_DashboardData> _future = _load();
  String? _enrollMessage;

  Future<_DashboardData> _load() async {
    final now = DateTime.now();
    final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    final profile = await widget.repo.profile();
    final plan = await widget.repo.activePlan();
    final calendar = plan == null ? <Map<String, dynamic>>[] : await widget.repo.calendar(plan['id'] as String);
    final workouts = await widget.repo.workoutsSince(_iso(monday));
    return _DashboardData(profile, plan, calendar, workouts);
  }

  static String _iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _enroll() async {
    final res = await widget.repo.enroll();
    setState(() {
      _enrollMessage = res['kind'] == 'enrolled' ? null : (res['message'] as String? ?? 'No pudimos asignar el plan.');
      _future = _load();
    });
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
          final today = _iso(DateTime.now());
          final todaySessions = d.calendar.where((c) => c['scheduled_date'] == today).toList();
          final weekDistance = d.workouts.where((w) => w['status'] != 'skipped').fold<int>(0, (a, w) => a + ((w['distance_m'] as int?) ?? 0));
          final version = d.plan?['version'] as Map<String, dynamic>?;
          return ListView(padding: const EdgeInsets.all(16), children: [
            Text('Hola, ${d.profile?['display_name'] ?? 'corredor'}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Brand.navy)),
            Text(formatDateLong(DateTime.now()), style: const TextStyle(color: Brand.muted)),
            const SizedBox(height: 16),
            if (d.profile?['onboarding_completed_at'] == null)
              const SectionCard(title: 'Completá tu perfil de corredor', child: Text('El cuestionario deportivo está disponible en la versión web. Pronto también en la app.'))
            else if (d.plan == null)
              SectionCard(
                title: 'Todavía no tenés un plan activo',
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('Te proponemos el plan publicado que corresponde a tu perfil.'),
                  if (_enrollMessage != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_enrollMessage!, style: const TextStyle(color: Brand.warning))),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _enroll, child: const Text('Obtener mi plan')),
                ]),
              )
            else
              SectionCard(
                title: 'ENTRENAMIENTO DE HOY',
                dark: true,
                trailing: version?['is_demo'] == true ? const DemoBadge() : null,
                child: todaySessions.isEmpty
                    ? const Text('Hoy no hay sesión planificada.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final s in todaySessions) ...[
                            Text((s['session'] as Map)['title'] as String, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                            Text('${sessionTypeLabels[(s['session'] as Map)['session_type']]} · ${formatMinutesLong((s['session'] as Map)['duration_s'] as int?)}'),
                            Text(calendarStatusLabels[s['status']] ?? ''),
                          ],
                          const SizedBox(height: 12),
                          FilledButton(onPressed: widget.onRegister, child: const Text('Registrar sesión')),
                        ],
                      ),
              ),
            const SizedBox(height: 16),
            SectionCard(
              title: 'Esta semana',
              child: Row(children: [
                Expanded(child: StatTile(label: 'Distancia', value: formatKm(weekDistance))),
                const SizedBox(width: 12),
                Expanded(child: StatTile(label: 'Entrenamientos', value: '${d.workouts.where((w) => w['status'] != 'skipped').length}')),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}
