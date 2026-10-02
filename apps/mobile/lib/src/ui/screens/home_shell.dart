import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/repository.dart';
import 'dashboard_screen.dart';
import 'plan_screen.dart';
import 'profile_screen.dart';
import 'progress_screen.dart';
import 'register_workout_screen.dart';

/// Navegación inferior: Inicio | Plan | Registrar | Progreso | Perfil.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final repo = Repository(Supabase.instance.client);

  @override
  Widget build(BuildContext context) {
    final pages = [
      DashboardScreen(repo: repo, onRegister: () => setState(() => _index = 2)),
      PlanScreen(repo: repo),
      RegisterWorkoutScreen(repo: repo, onSaved: () => setState(() => _index = 0)),
      ProgressScreen(repo: repo),
      ProfileScreen(repo: repo),
    ];
    return Scaffold(
      body: SafeArea(child: IndexedStack(index: _index, children: pages)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Inicio'),
          NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Plan'),
          NavigationDestination(icon: Icon(Icons.add_circle_outline), label: 'Registrar'),
          NavigationDestination(icon: Icon(Icons.bar_chart_outlined), label: 'Progreso'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Perfil'),
        ],
      ),
    );
  }
}
