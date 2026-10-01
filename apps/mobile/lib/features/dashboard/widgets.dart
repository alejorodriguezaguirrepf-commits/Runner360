import 'package:flutter/material.dart';

import '../../core/format.dart';
import '../../core/theme.dart';
import '../../data/models.dart';

class DemoBadge extends StatelessWidget {
  const DemoBadge({super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(color: R360Colors.warningBg, borderRadius: BorderRadius.circular(99), border: Border.all(color: R360Colors.warning.withValues(alpha: .3))),
        child: const Text('DEMO / NO VALIDADO', style: TextStyle(color: R360Colors.warning, fontSize: 11, fontWeight: FontWeight.w700)),
      );
}

String sessionMeta(PlannedSession s) => [
      if (s.durationS != null) formatDuration(s.durationS!),
      if (s.distanceM != null) formatKm(s.distanceM!),
      '${intensityLabels[s.intensity] ?? s.intensity}${s.rpeMin != null && s.rpeMax != null ? ' · RPE ${s.rpeMin}-${s.rpeMax}' : ''}',
    ].join(' · ');

class StateMessage extends StatelessWidget {
  const StateMessage({super.key, required this.icon, required this.title, this.body, this.action});
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 40, color: R360Colors.navy),
            const SizedBox(height: 12),
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            if (body != null) ...[const SizedBox(height: 6), Text(body!, textAlign: TextAlign.center, style: const TextStyle(color: R360Colors.muted))],
            if (action != null) ...[const SizedBox(height: 16), action!],
          ]),
        ),
      );
}

/// Envuelve un Future con estados de carga, error y contenido.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.future, required this.builder});
  final Future<T> future;
  final Widget Function(BuildContext, T) builder;
  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(semanticsLabel: 'Cargando'));
          }
          if (snap.hasError) {
            return const StateMessage(icon: Icons.cloud_off, title: 'No pudimos cargar los datos', body: 'Revisá tu conexión e intentá nuevamente.');
          }
          return builder(context, snap.data as T);
        },
      );
}
