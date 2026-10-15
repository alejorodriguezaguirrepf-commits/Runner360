import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tema elegido por la persona: Claro (por defecto), Oscuro o Automático (según el sistema).
/// Se recuerda en el dispositivo.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController() : super(ThemeMode.light);

  static const _key = 'r360-theme';

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      value = _fromName(prefs.getString(_key));
    } catch (_) {
      value = ThemeMode.light;
    }
  }

  Future<void> set(ThemeMode mode) async {
    value = mode;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_key, _toName(mode));
    } catch (_) {
      // Sin almacenamiento disponible: el tema se aplica solo en esta sesión.
    }
  }

  static ThemeMode _fromName(String? name) => switch (name) {
        'dark' => ThemeMode.dark,
        'system' => ThemeMode.system,
        _ => ThemeMode.light,
      };

  static String _toName(ThemeMode mode) => switch (mode) {
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
        ThemeMode.light => 'light',
      };
}

final themeController = ThemeController();
