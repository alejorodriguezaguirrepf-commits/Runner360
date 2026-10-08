import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../domain/format.dart';
import '../../theme.dart';
import '../widgets.dart';

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key, required this.repo});
  final Repository repo;

  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  late Future<(Map<String, dynamic>?, List<Map<String, dynamic>>)> _future = _load();

  Future<(Map<String, dynamic>?, List<Map<String, dynamic>>)> _load() async {
    final plan = await widget.repo.activePlan();
    if (plan == null) return (null, <Map<String, dynamic>>[]);
    return (plan, await widget.repo.calendar(plan['id'] as String));
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snap.hasError) return ErrorView(message: 'No pudimos cargar tu plan.', onRetry: () => setState(() => _future = _load()));
        final (plan, calendar) = snap.data!;
        if (plan == null) {
          return const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('Todavía no tenés un plan activo. Obtené tu plan desde Inicio.', textAlign: TextAlign.center)));
        }
        final version = plan['version'] as Map<String, dynamic>;
        final byWeek = <int, List<Map<String, dynamic>>>{};
        for (final c in calendar) {
          byWeek.putIfAbsent(c['week_number'] as int, () => []).add(c);
        }
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text(version['name'] as String, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Brand.navy)),
          if (version['is_demo'] == true) ...[
            const SizedBox(height: 8),
            const DemoBadge(),
            const SizedBox(height: 4),
            const Text('Estructura de ejemplo, no validada por un profesional.', style: TextStyle(color: Brand.warning, fontSize: 12)),
          ],
          const SizedBox(height: 16),
          for (final entry in byWeek.entries) ...[
            SectionCard(
              title: 'Semana ${entry.key}',
              child: Column(children: [
                for (final c in entry.value)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text((c['session'] as Map)['title'] as String, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text('${formatDateShort(DateTime.parse(c['scheduled_date'] as String))} · ${formatMinutesLong((c['session'] as Map)['duration_s'] as int?)}'),
                    trailing: Text(calendarStatusLabels[c['status']] ?? '', style: const TextStyle(fontSize: 12, color: Brand.muted)),
                    onTap: () => _showSession(context, c),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
          ],
        ]);
      },
    );
  }

  void _showSession(BuildContext context, Map<String, dynamic> c) {
    final s = c['session'] as Map<String, dynamic>;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SafeArea(
        child: ListView(shrinkWrap: true, padding: const EdgeInsets.all(20), children: [
          Text(s['title'] as String, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          Text('${sessionTypeLabels[s['session_type']]} · ${formatMinutesLong(s['duration_s'] as int?)}${s['rpe_min'] != null ? ' · RPE ${s['rpe_min']}–${s['rpe_max']}' : ''}'),
          const SizedBox(height: 16),
          const Text('Entrada en calor', style: TextStyle(fontWeight: FontWeight.w700)),
          Text(s['warmup'] as String? ?? '—'),
          const SizedBox(height: 8),
          const Text('Parte principal', style: TextStyle(fontWeight: FontWeight.w700)),
          Text(s['main_set'] as String? ?? '—'),
          const SizedBox(height: 8),
          const Text('Vuelta a la calma', style: TextStyle(fontWeight: FontWeight.w700)),
          Text(s['cooldown'] as String? ?? '—'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Brand.warningBg, borderRadius: BorderRadius.circular(12)),
            child: Text('Cuándo reducir o suspender: ${s['stop_criteria'] ?? ''}', style: const TextStyle(color: Brand.warning)),
          ),
        ]),
      ),
    );
  }
}
