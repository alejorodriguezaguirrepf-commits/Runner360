import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../domain/format.dart';
import '../../theme.dart';
import '../widgets.dart';

class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key, required this.repo});
  final Repository repo;

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();

  Future<List<Map<String, dynamic>>> _load() {
    final from = DateTime.now().subtract(const Duration(days: 28));
    return widget.repo.workoutsSince('${from.year}-${from.month.toString().padLeft(2, '0')}-${from.day.toString().padLeft(2, '0')}');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
        if (snap.hasError) return ErrorView(message: 'No pudimos cargar tu progreso.', onRetry: () => setState(() => _future = _load()));
        final done = snap.data!.where((w) => w['status'] != 'skipped').toList();
        final distance = done.fold<int>(0, (a, w) => a + ((w['distance_m'] as int?) ?? 0));
        final duration = done.fold<int>(0, (a, w) => a + ((w['duration_s'] as int?) ?? 0));
        return ListView(padding: const EdgeInsets.all(16), children: [
          const Text('Progreso', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Brand.navy)),
          const Text('Últimas 4 semanas, a partir de tus registros.', style: TextStyle(color: Brand.muted)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: StatTile(label: 'Distancia', value: formatKm(distance))),
            const SizedBox(width: 12),
            Expanded(child: StatTile(label: 'Tiempo', value: formatMinutesLong(duration))),
          ]),
          const SizedBox(height: 12),
          StatTile(label: 'Entrenamientos', value: '${done.length}'),
          const SizedBox(height: 16),
          const Text('Los gráficos detallados están disponibles en la versión web.', style: TextStyle(color: Brand.muted)),
        ]);
      },
    );
  }
}
