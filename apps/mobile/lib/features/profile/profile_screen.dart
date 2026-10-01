import 'package:flutter/material.dart';

import '../../data/repository.dart';
import '../../payments/iap_gateway.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.repo, this.iap});
  final Repository repo;
  final IapGateway? iap;

  @override
  Widget build(BuildContext context) {
    final gateway = iap ?? PendingIapGateway();
    final email = repo.client.auth.currentUser?.email ?? '';
    return ListView(padding: const EdgeInsets.all(16), children: [
      Text('Perfil', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      Text(email),
      const SizedBox(height: 16),
      const Card(
        child: ListTile(
          leading: Icon(Icons.edit_note),
          title: Text('Perfil de corredor, privacidad y exportación de datos'),
          subtitle: Text('Por ahora se gestionan desde la versión web.'),
        ),
      ),
      Card(
        child: ListTile(
          leading: const Icon(Icons.workspace_premium_outlined),
          title: const Text('Premium'),
          subtitle: Text(gateway.isAvailable ? 'Disponible' : 'Las compras dentro de la app están pendientes de configuración.'),
        ),
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(onPressed: () => repo.client.auth.signOut(), icon: const Icon(Icons.logout), label: const Text('Cerrar sesión')),
    ]);
  }
}
