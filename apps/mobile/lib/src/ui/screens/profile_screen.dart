import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../theme.dart';
import '../../theme_controller.dart';
import '../widgets.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.repo});
  final Repository repo;

  Future<(Map<String, dynamic>?, bool)> _load() async => (await repo.profile(), await repo.hasPremium());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<(Map<String, dynamic>?, bool)>(
      future: _load(),
      builder: (context, snap) {
        final profile = snap.data?.$1;
        final premium = snap.data?.$2 ?? false;
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text('Perfil', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: context.colors.ink)),
          const SizedBox(height: 16),
          SectionCard(
            title: profile?['display_name'] as String? ?? '—',
            child: Text(premium ? 'Plan Premium' : 'Plan Free'),
          ),
          const SizedBox(height: 12),
          const SectionCard(title: 'Apariencia', child: ThemeSelector()),
          const SizedBox(height: 12),
          const SectionCard(
            title: 'Suscripción en la app',
            child: Text('Las compras dentro de la app están pendientes de configuración.'),
          ),
          const SizedBox(height: 12),
          const SectionCard(
            title: 'Privacidad',
            child: Text('Podés descargar o eliminar tus datos desde tu perfil en la versión web. No recopilamos tu ubicación.'),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => repo.client.auth.signOut(),
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
          ),
        ]);
      },
    );
  }
}


/// Claro (predeterminado), Oscuro o Automático (según el sistema). Se recuerda en el dispositivo.
class ThemeSelector extends StatelessWidget {
  const ThemeSelector({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeController,
      builder: (context, mode, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Elegí cómo se ve la app en este dispositivo.', style: TextStyle(color: context.colors.muted)),
          const SizedBox(height: 12),
          SegmentedButton<ThemeMode>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: ThemeMode.light, label: Text('Claro')),
              ButtonSegment(value: ThemeMode.dark, label: Text('Oscuro')),
              ButtonSegment(value: ThemeMode.system, label: Text('Automático')),
            ],
            selected: {mode},
            onSelectionChanged: (s) => themeController.set(s.first),
          ),
        ],
      ),
    );
  }
}
