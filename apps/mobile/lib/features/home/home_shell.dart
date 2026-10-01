import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/repository.dart';
import '../dashboard/dashboard_screen.dart';
import '../plan/plan_screen.dart';
import '../profile/profile_screen.dart';
import '../progress/progress_screen.dart';
import '../register/register_screen.dart';

/// Navegación inferior: Inicio | Plan | Registrar | Progreso | Perfil.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  late final repo = Repository(Supabase.instance.client);
  int _refresh = 0;

  void _go(int i) => setState(() {
        _index = i;
        _refresh++;
      });

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(key: ValueKey('d$_refresh'), repo: repo, onRegister: () => _go(2)),
      PlanScreen(key: ValueKey('p$_refresh'), repo: repo),
      RegisterScreen(repo: repo, onSaved: () => _go(3)),
      ProgressScreen(key: ValueKey('g$_refresh'), repo: repo),
      ProfileScreen(repo: repo),
    ];
    return Scaffold(
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Inicio'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Plan'),
          NavigationDestination(icon: Icon(Icons.add_circle_outline), label: 'Registrar'),
          NavigationDestination(icon: Icon(Icons.show_chart), label: 'Progreso'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Perfil'),
        ],
      ),
    );
  }
}
