import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/config.dart';
import 'core/theme.dart';
import 'features/auth/sign_in_screen.dart';
import 'features/home/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es_AR');
  if (AppConfig.isConfigured) {
    await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabaseAnonKey);
  }
  runApp(const Runner360App());
}

class Runner360App extends StatelessWidget {
  const Runner360App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RUNNER 360',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: const Locale('es', 'AR'),
      supportedLocales: const [Locale('es', 'AR'), Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppConfig.isConfigured ? const AuthGate() : const ConfigPendingScreen(),
    );
  }
}

/// Muestra el estado real cuando faltan credenciales: no se simula ninguna conexión.
class ConfigPendingScreen extends StatelessWidget {
  const ConfigPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('RUNNER 360', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: R360Colors.navy)),
              SizedBox(height: 8),
              Text('Entrená. Medí. Progresá.', style: TextStyle(color: R360Colors.muted)),
              SizedBox(height: 32),
              Text('Configuración pendiente', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              SizedBox(height: 8),
              Text(
                'Esta compilación no tiene credenciales de Supabase. Ejecutá la app con '
                '--dart-define=SUPABASE_URL, SUPABASE_ANON_KEY y API_BASE_URL (ver apps/mobile/README.md).',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, _) => auth.currentSession == null ? const SignInScreen() : const HomeShell(),
    );
  }
}
