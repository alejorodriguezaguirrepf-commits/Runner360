import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/metrics.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repository.dart';
import '../dashboard/widgets.dart';

class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key, required this.repo});
  final Repository repo;

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<WorkoutLog>>(
      future: repo.workouts(),
      builder: (context, logs) {
        if (logs.isEmpty) {
          return const StateMessage(icon: Icons.show_chart, title: 'Sin datos todavía', body: 'Tu evolución se calcula solo con tus registros reales.');
        }
        final weeks = weeklyTotals(logs.map((l) => (startedAt: l.startedAt, distanceM: l.distanceM, durationS: l.durationS, status: l.status)));
        final last = weeks.length > 12 ? weeks.sublist(weeks.length - 12) : weeks;
        final maxM = last.fold<int>(1, (a, w) => w.distanceM > a ? w.distanceM : a);
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text('Progreso', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Kilómetros por semana', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                for (final w in last)
                  Semantics(
                    label: 'Semana del ${w.key}: ${formatKm(w.distanceM)}',
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(children: [
                        SizedBox(width: 84, child: Text(w.key.substring(5), style: const TextStyle(color: R360Colors.muted, fontSize: 12))),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(value: w.distanceM / maxM, minHeight: 10, color: R360Colors.navy600, backgroundColor: R360Colors.line),
                          ),
                        ),
                        SizedBox(width: 72, child: Text(formatKm(w.distanceM, fractionDigits: 1), textAlign: TextAlign.right)),
                      ]),
                    ),
                  ),
              ]),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(children: [
              for (final l in logs.take(20))
                ListTile(
                  title: Text('${formatKm(l.distanceM)} · ${formatDuration(l.durationS)}'),
                  subtitle: Text(l.startedAt.toLocal().toString().substring(0, 16)),
                  trailing: Text(formatPace(paceSecondsPerKm(l.distanceM, l.durationS))),
                ),
            ]),
          ),
        ]);
      },
    );
  }
}
