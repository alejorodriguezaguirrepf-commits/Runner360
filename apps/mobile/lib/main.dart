import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/config.dart';
import 'src/theme.dart';
import 'src/ui/screens/auth_screen.dart';
import 'src/ui/screens/config_missing_screen.dart';
import 'src/ui/screens/home_shell.dart';

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
      supportedLocales: const [Locale('es', 'AR')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppConfig.isConfigured ? const AuthGate() : const ConfigMissingScreen(),
    );
  }
}

/// Muestra el ingreso o la app según la sesión de Supabase.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, _) => auth.currentSession == null ? const AuthScreen() : const HomeShell(),
    );
  }
}
