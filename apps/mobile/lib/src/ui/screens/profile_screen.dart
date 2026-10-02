import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../theme.dart';
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
          const Text('Perfil', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Brand.navy)),
          const SizedBox(height: 16),
          SectionCard(
            title: profile?['display_name'] as String? ?? '—',
            child: Text(premium ? 'Plan Premium' : 'Plan Free'),
          ),
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
