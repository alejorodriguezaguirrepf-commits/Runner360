import 'package:flutter/material.dart';

/// Sistema visual RUNNER 360 (mismos tokens que la web, tema claro).
/// Turquesa para acciones y progreso; lima solo para destacados y estado seleccionado.
class Brand {
  static const night = Color(0xFF101C2C);
  static const teal = Color(0xFF18A999);
  static const tealInk = Color(0xFF0A7266);
  static const lime = Color(0xFFD9F36A);

  static const canvas = Color(0xFFF5F7FA);
  static const surface = Color(0xFFFFFFFF);
  static const surface2 = Color(0xFFEEF2F6);
  static const ink = Color(0xFF101C2C);
  static const muted = Color(0xFF5B6B80);
  static const line = Color(0xFFE2E8F0);
  static const field = Color(0xFF7B8BA0);

  /// Zonas azul noche (tarjeta destacada): texto claro.
  static const navyDeep = night;
  static const navInk = Color(0xFFF5F7FA);
  static const navMuted = Color(0xFFB8C5D3);

  static const warning = Color(0xFF92400E);
  static const warningBg = Color(0xFFFFF7E6);
  static const danger = Color(0xFFB42318);

  /// Compatibilidad con nombres anteriores.
  static const navy = night;
  static const navy700 = tealInk;
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.teal,
    brightness: Brightness.light,
    primary: Brand.teal,
    onPrimary: Brand.night,
    secondary: Brand.lime,
    onSecondary: Brand.night,
    surface: Brand.surface,
    onSurface: Brand.ink,
    error: Brand.danger,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: scheme,
    scaffoldBackgroundColor: Brand.canvas,
    textTheme: ThemeData(brightness: Brightness.light).textTheme.apply(bodyColor: Brand.ink, displayColor: Brand.ink),
    appBarTheme: const AppBarTheme(backgroundColor: Brand.canvas, foregroundColor: Brand.ink, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: Brand.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Brand.line)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.teal,
        foregroundColor: Brand.night,
        minimumSize: const Size.fromHeight(48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.surface,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Brand.field)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Brand.field)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Brand.tealInk, width: 2)),
    ),
    navigationBarTheme: const NavigationBarThemeData(backgroundColor: Brand.surface, indicatorColor: Brand.lime),
  );
}
