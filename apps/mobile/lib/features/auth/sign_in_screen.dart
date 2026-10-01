import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/theme.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _signUp = false;
  bool _accept = false;
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (_signUp && !_accept) {
      setState(() => _message = 'Necesitás aceptar los términos y la política de privacidad.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    final auth = Supabase.instance.client.auth;
    try {
      if (_signUp) {
        final res = await auth.signUp(
          email: _email.text.trim(),
          password: _password.text,
          data: {
            'display_name': _name.text.trim(),
            'accepted_terms_version': '2026-10-borrador-1',
            'accepted_privacy_version': '2026-10-borrador-1',
          },
        );
        if (res.session == null) {
          setState(() => _message = 'Te enviamos un correo para confirmar tu cuenta.');
        }
      } else {
        await auth.signInWithPassword(email: _email.text.trim(), password: _password.text);
      }
    } on AuthException {
      setState(() => _message = _signUp ? 'No pudimos crear la cuenta.' : 'Correo o contraseña incorrectos.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('RUNNER 360', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: R360Colors.navy)),
                  const Text('Entrená. Medí. Progresá.', style: TextStyle(color: R360Colors.muted)),
                  const SizedBox(height: 32),
                  Text(_signUp ? 'Creá tu cuenta' : 'Ingresá a tu cuenta', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 16),
                  if (_message != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_message!, style: const TextStyle(color: R360Colors.danger)),
                    ),
                  if (_signUp) ...[
                    TextFormField(
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Nombre visible'),
                      validator: (v) => (v == null || v.trim().length < 2) ? 'Ingresá al menos 2 caracteres' : null,
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Correo electrónico'),
                    validator: (v) => (v == null || !v.contains('@')) ? 'Ingresá un correo válido' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Contraseña'),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Ingresá tu contraseña';
                      if (_signUp && (v.length < 8 || !RegExp(r'[A-Za-z]').hasMatch(v) || !RegExp(r'\d').hasMatch(v))) {
                        return 'Mínimo 8 caracteres, con letras y números';
                      }
                      return null;
                    },
                  ),
                  if (_signUp)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _accept,
                      onChanged: (v) => setState(() => _accept = v ?? false),
                      title: const Text('Acepto los términos y la política de privacidad (borradores beta).'),
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Procesando…' : (_signUp ? 'Crear cuenta gratis' : 'Ingresar')),
                  ),
                  TextButton(
                    onPressed: () => setState(() {
                      _signUp = !_signUp;
                      _message = null;
                    }),
                    child: Text(_signUp ? 'Ya tengo cuenta' : 'Crear una cuenta'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
