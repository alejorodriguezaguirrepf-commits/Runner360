import 'package:flutter/material.dart';

import '../../theme.dart';

class ConfigMissingScreen extends StatelessWidget {
  const ConfigMissingScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('RUNNER 360', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Brand.navy)),
              SizedBox(height: 16),
              Text('Configuración pendiente', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
              SizedBox(height: 8),
              Text('Esta compilación no tiene credenciales de Supabase. Ejecutá la app con --dart-define=SUPABASE_URL y SUPABASE_ANON_KEY (ver apps/mobile/README.md).'),
            ]),
          ),
        ),
      );
}
