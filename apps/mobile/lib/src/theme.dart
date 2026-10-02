import 'package:flutter/material.dart';

/// Identidad visual RUNNER 360 (mismos tokens que la web).
class Brand {
  static const navy = Color(0xFF122438);
  static const navy700 = Color(0xFF26446A);
  static const lime = Color(0xFFD5F36A);
  static const canvas = Color(0xFFF6F8FA);
  static const muted = Color(0xFF55657A);
  static const line = Color(0xFFDFE5EC);
  static const warning = Color(0xFF8A5300);
  static const warningBg = Color(0xFFFFF7E6);
  static const danger = Color(0xFFB42318);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.navy,
    primary: Brand.navy,
    secondary: Brand.lime,
    surface: Colors.white,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Brand.canvas,
    appBarTheme: const AppBarTheme(backgroundColor: Brand.canvas, foregroundColor: Brand.navy, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: Colors.white,
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
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Brand.line)),
    ),
    navigationBarTheme: const NavigationBarThemeData(backgroundColor: Colors.white, indicatorColor: Brand.lime),
  );
}
