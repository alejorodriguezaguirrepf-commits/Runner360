import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

/// Registro en la web: allá se verifica que no sea un robot y se entra directo, sin correo de confirmación.
final signUpUrl = Uri.parse('https://runner360.vercel.app/registro');

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _message;

  Future<void> _submit() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
    } on AuthRetryableFetchException {
      // Sin conexión o servidor inaccesible: no es un problema de credenciales.
      setState(() => _message = 'No pudimos conectarnos. Revisá tu conexión.');
    } on AuthException {
      setState(() => _message = 'Correo o contraseña incorrectos.');
    } catch (_) {
      setState(() => _message = 'No pudimos conectarnos. Revisá tu conexión.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openSignUp() async {
    final ok = await launchUrl(signUpUrl, mode: LaunchMode.externalApplication);
    if (!ok && mounted) setState(() => _message = 'Abrí runner360.vercel.app/registro en el navegador para crear tu cuenta.');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 24),
            Text(
              'RUNNER 360',
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: context.colors.ink),
            ),
            Text('Entrená. Medí. Progresá.', style: TextStyle(color: context.colors.muted)),
            const SizedBox(height: 32),
            const Text('Ingresá a tu cuenta', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Correo electrónico'),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              decoration: const InputDecoration(labelText: 'Contraseña'),
              obscureText: true,
            ),
            if (_message != null)
              Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text(_message!, style: TextStyle(color: context.colors.danger)),
              ),
            const SizedBox(height: 20),
            FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Procesando…' : 'Ingresar')),
            TextButton(onPressed: _openSignUp, child: const Text('Crear cuenta gratis')),
            Text(
              'La cuenta se crea en la web en un minuto; después ingresás acá con tu correo y tu contraseña.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: context.colors.muted),
            ),
          ],
        ),
      ),
    );
  }
}
