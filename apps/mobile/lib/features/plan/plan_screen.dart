import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme.dart';
import '../../data/models.dart';
import '../../data/repository.dart';
import '../dashboard/widgets.dart';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key, required this.repo});
  final Repository repo;
  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  late Future<ActivePlan?> _future = widget.repo.activePlan();
  String? _error;
  bool _busy = false;

  Future<void> _start() async {
    setState(() => _busy = true);
    final err = await widget.repo.startSuggestedPlan();
    setState(() {
      _busy = false;
      _error = err == null ? null : 'No pudimos iniciar el plan automáticamente ($err). Revisá tu perfil en la web.';
      _future = widget.repo.activePlan();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<ActivePlan?>(
      future: _future,
      builder: (context, plan) {
        if (plan == null) {
          return StateMessage(
            icon: Icons.calendar_month,
            title: 'Sin plan activo',
            body: _error ?? 'Iniciá el plan sugerido según tu perfil. La selección la realiza el servidor con reglas verificables.',
            action: FilledButton(onPressed: _busy ? null : _start, child: Text(_busy ? 'Preparando…' : 'Iniciar plan sugerido')),
          );
        }
        final byWeek = <int, List<CalendarItem>>{};
        for (final c in plan.calendar) {
          byWeek.putIfAbsent(c.weekNumber, () => []).add(c);
        }
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text(plan.name, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: R360Colors.navy, fontWeight: FontWeight.w700)),
          if (plan.isDemo) const Padding(padding: EdgeInsets.only(top: 8), child: Align(alignment: Alignment.centerLeft, child: DemoBadge())),
          const SizedBox(height: 12),
          for (final e in byWeek.entries)
            Card(
              child: ExpansionTile(
                title: Text('Semana ${e.key}'),
                children: [
                  for (final c in e.value)
                    ListTile(
                      leading: Text(DateFormat('EEE d', 'es_AR').format(DateTime.parse(c.date))),
                      title: Text(c.session.title),
                      subtitle: Text(sessionMeta(c.session)),
                      trailing: c.logStatus == null
                          ? null
                          : Icon(c.logStatus == 'skipped' ? Icons.close : Icons.check_circle, color: c.logStatus == 'skipped' ? R360Colors.danger : R360Colors.success, semanticLabel: c.logStatus),
                    ),
                ],
              ),
            ),
        ]);
      },
    );
  }
}
