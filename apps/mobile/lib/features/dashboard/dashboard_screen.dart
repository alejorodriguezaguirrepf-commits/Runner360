import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repository.dart';
import 'widgets.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.repo, required this.onRegister});
  final Repository repo;
  final VoidCallback onRegister;

  Future<(String?, ActivePlan?, List<WorkoutLog>)> _load() async {
    final p = await repo.profile();
    return (p.displayName, await repo.activePlan(), await repo.workouts(limit: 50));
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView(
      future: _load(),
      builder: (context, data) {
        final (name, plan, logs) = data;
        final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
        final next = plan?.calendar.where((c) => c.date.compareTo(today) >= 0 && c.logStatus == null && c.session.type != 'rest').firstOrNull;
        final weekStart = DateTime.now().subtract(Duration(days: DateTime.now().weekday - 1));
        final weekLogs = logs.where((l) => !l.startedAt.toLocal().isBefore(DateTime(weekStart.year, weekStart.month, weekStart.day)) && l.status != 'skipped');
        final weekM = weekLogs.fold<int>(0, (a, l) => a + l.distanceM);
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text('Hola, ${name ?? 'corredor'}', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: R360Colors.navy)),
          const SizedBox(height: 16),
          if (plan == null)
            const StateMessage(icon: Icons.calendar_month, title: 'Todavía no tenés un plan activo', body: 'Abrí la pestaña Plan para ver tu sugerencia.')
          else
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: R360Colors.navy, borderRadius: BorderRadius.circular(16)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(next?.date == today ? 'ENTRENAMIENTO DE HOY' : 'PRÓXIMA SESIÓN', style: const TextStyle(color: R360Colors.lime, fontWeight: FontWeight.w700, fontSize: 12))),
                  if (plan.isDemo) const DemoBadge(),
                ]),
                const SizedBox(height: 8),
                if (next == null)
                  const Text('No hay sesiones pendientes.', style: TextStyle(color: Colors.white))
                else ...[
                  Text(next.session.title, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                  Text('${sessionTypeLabels[next.session.type]} · ${DateFormat('EEEE d MMM', 'es_AR').format(DateTime.parse(next.date))}', style: const TextStyle(color: Colors.white70)),
                  const SizedBox(height: 8),
                  Text(next.session.objective, style: const TextStyle(color: Colors.white)),
                  const SizedBox(height: 6),
                  Text(sessionMeta(next.session), style: const TextStyle(color: Colors.white70)),
                  const SizedBox(height: 6),
                  Text(next.session.mainSet, style: const TextStyle(color: Colors.white70)),
                ],
              ]),
            ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: const Text('Realizado esta semana'),
              trailing: Text(formatKm(weekM), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: onRegister, icon: const Icon(Icons.add), label: const Text('Registrar entrenamiento')),
        ]);
      },
    );
  }
}
