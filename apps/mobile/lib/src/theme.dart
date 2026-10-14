import 'package:flutter/material.dart';

/// Identidad visual RUNNER 360 (mismos tokens que la web): fondo azul marino y letras verdes.
class Brand {
  static const navy = Color(0xFF0B1D36);
  static const navyDeep = Color(0xFF061224);
  static const navy700 = Color(0xFF1D3A63);
  static const surface = Color(0xFF0F2443);
  static const ink = Color(0xFF86EFAC);
  static const lime = Color(0xFF4ADE80);
  static const canvas = Color(0xFF0B1D36);
  static const muted = Color(0xFF9CC9AD);
  static const line = Color(0xFF24456F);
  static const warning = Color(0xFFFCD34D);
  static const warningBg = Color(0xFF332A10);
  static const danger = Color(0xFFFCA5A5);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.lime,
    brightness: Brightness.dark,
    primary: Brand.lime,
    onPrimary: Brand.navy,
    secondary: Brand.lime,
    surface: Brand.surface,
    onSurface: Brand.ink,
    error: Brand.danger,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: Brand.canvas,
    textTheme: ThemeData(brightness: Brightness.dark).textTheme.apply(bodyColor: Brand.ink, displayColor: Brand.ink),
    appBarTheme: const AppBarTheme(backgroundColor: Brand.canvas, foregroundColor: Brand.ink, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: Brand.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Brand.line)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Brand.lime,
        foregroundColor: Brand.navy,
        minimumSize: const Size.fromHeight(48),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Brand.navyDeep,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Brand.line)),
    ),
    navigationBarTheme: const NavigationBarThemeData(backgroundColor: Brand.navyDeep, indicatorColor: Brand.lime),
  );
}
