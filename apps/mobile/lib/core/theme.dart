import 'package:flutter/material.dart';

/// Identidad visual compartida con la web (ver apps/web/src/app/globals.css).
class R360Colors {
  static const navy = Color(0xFF122438);
  static const navy600 = Color(0xFF26476D);
  static const surface = Color(0xFFF6F8FA);
  static const lime = Color(0xFFD5F36A);
  static const muted = Color(0xFF55657A);
  static const line = Color(0xFFE2E8EF);
  static const danger = Color(0xFFB42318);
  static const success = Color(0xFF157F3C);
  static const warning = Color(0xFF93370D);
  static const warningBg = Color(0xFFFFFAEB);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: R360Colors.navy,
    primary: R360Colors.navy,
    secondary: R360Colors.lime,
    surface: Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: R360Colors.surface,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: R360Colors.navy,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: R360Colors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: R360Colors.lime,
        foregroundColor: R360Colors.navy,
        minimumSize: const Size(48, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: R360Colors.lime,
    ),
  );
}
