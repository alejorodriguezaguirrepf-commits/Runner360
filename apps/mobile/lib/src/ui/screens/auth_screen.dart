import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../theme.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;
  bool _acceptTerms = false;
  bool _loading = false;
  String? _message;

  Future<void> _submit() async {
    final auth = Supabase.instance.client.auth;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      if (_register) {
        if (!_acceptTerms) throw const AuthException('Tenés que aceptar los términos y la política de privacidad');
        final pwd = _password.text;
        if (pwd.length < 10 || !RegExp(r'[A-Za-z]').hasMatch(pwd) || !RegExp(r'\d').hasMatch(pwd)) {
          throw const AuthException('La contraseña debe tener al menos 10 caracteres, con letras y números');
        }
        final res = await auth.signUp(email: _email.text.trim(), password: pwd, data: {'display_name': _name.text.trim()});
        if (res.session == null) setState(() => _message = 'Te enviamos un correo para confirmar tu cuenta.');
      } else {
        await auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException catch (e) {
      setState(() => _message = _register ? e.message : 'Correo o contraseña incorrectos.');
    } catch (_) {
      setState(() => _message = 'No pudimos conectarnos. Revisá tu conexión.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 24),
            const Text('RUNNER 360', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900, color: Brand.navy)),
            const Text('Entrená. Medí. Progresá.', style: TextStyle(color: Brand.muted)),
            const SizedBox(height: 32),
            Text(_register ? 'Creá tu cuenta gratis' : 'Ingresá a tu cuenta', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            if (_register) ...[
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nombre visible'), textInputAction: TextInputAction.next),
              const SizedBox(height: 12),
            ],
            TextField(controller: _email, decoration: const InputDecoration(labelText: 'Correo electrónico'), keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email]),
            const SizedBox(height: 12),
            TextField(controller: _password, decoration: const InputDecoration(labelText: 'Contraseña'), obscureText: true),
            if (_register)
              CheckboxListTile(
                value: _acceptTerms,
                onChanged: (v) => setState(() => _acceptTerms = v ?? false),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                title: const Text('Acepto los términos y la política de privacidad (borradores de la beta).'),
              ),
            if (_message != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_message!, style: const TextStyle(color: Brand.danger))),
            const SizedBox(height: 20),
            FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Procesando…' : (_register ? 'Comenzar gratis' : 'Ingresar'))),
            TextButton(
              onPressed: () => setState(() {
                _register = !_register;
                _message = null;
              }),
              child: Text(_register ? 'Ya tengo cuenta' : 'Crear cuenta'),
            ),
          ],
        ),
      ),
    );
  }
}
