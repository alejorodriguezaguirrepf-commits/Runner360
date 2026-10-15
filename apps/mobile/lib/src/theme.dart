import 'package:flutter/material.dart';

/// Colores fijos de la marca RUNNER 360 (iguales en ambos temas).
class Brand {
  static const night = Color(0xFF101C2C);
  static const teal = Color(0xFF18A999);
  static const lime = Color(0xFFD9F36A);
}

/// Tokens semánticos (mismos valores que la web, ver docs/DESIGN_SYSTEM.md).
/// Las pantallas los leen con `context.colors`, así responden al tema claro u oscuro.
@immutable
class R360Colors extends ThemeExtension<R360Colors> {
  const R360Colors({
    required this.canvas,
    required this.surface,
    required this.surface2,
    required this.ink,
    required this.muted,
    required this.line,
    required this.field,
    required this.primaryInk,
    required this.nav,
    required this.navInk,
    required this.navMuted,
    required this.warning,
    required this.warningBg,
    required this.danger,
    required this.success,
    required this.successBg,
  });

  final Color canvas;
  final Color surface;
  final Color surface2;
  final Color ink;
  final Color muted;
  final Color line;
  final Color field;

  /// Texto turquesa con contraste AA sobre las superficies del tema.
  final Color primaryInk;

  /// Zona azul noche (tarjeta destacada) y su texto.
  final Color nav;
  final Color navInk;
  final Color navMuted;
  final Color warning;
  final Color warningBg;
  final Color danger;
  final Color success;
  final Color successBg;

  static const light = R360Colors(
    canvas: Color(0xFFF5F7FA),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFEEF2F6),
    ink: Color(0xFF101C2C),
    muted: Color(0xFF5B6B80),
    line: Color(0xFFE2E8F0),
    field: Color(0xFF7B8BA0),
    primaryInk: Color(0xFF0A7266),
    nav: Color(0xFF101C2C),
    navInk: Color(0xFFF5F7FA),
    navMuted: Color(0xFFB8C5D3),
    warning: Color(0xFF92400E),
    warningBg: Color(0xFFFFF7E6),
    danger: Color(0xFFB42318),
    success: Color(0xFF166534),
    successBg: Color(0xFFECFDF3),
  );

  static const dark = R360Colors(
    canvas: Color(0xFF101820),
    surface: Color(0xFF1D2C3E),
    surface2: Color(0xFF25364A),
    ink: Color(0xFFF5F7FA),
    muted: Color(0xFFB8C5D3),
    line: Color(0xFF344558),
    field: Color(0xFF71859E),
    primaryInk: Color(0xFF3FD0BE),
    nav: Color(0xFF0B131B),
    navInk: Color(0xFFF5F7FA),
    navMuted: Color(0xFFB8C5D3),
    warning: Color(0xFFFCD34D),
    warningBg: Color(0xFF3A2E0F),
    danger: Color(0xFFFCA5A5),
    success: Color(0xFF86EFAC),
    successBg: Color(0xFF123A2B),
  );

  @override
  R360Colors copyWith({
    Color? canvas,
    Color? surface,
    Color? surface2,
    Color? ink,
    Color? muted,
    Color? line,
    Color? field,
    Color? primaryInk,
    Color? nav,
    Color? navInk,
    Color? navMuted,
    Color? warning,
    Color? warningBg,
    Color? danger,
    Color? success,
    Color? successBg,
  }) => R360Colors(
    canvas: canvas ?? this.canvas,
    surface: surface ?? this.surface,
    surface2: surface2 ?? this.surface2,
    ink: ink ?? this.ink,
    muted: muted ?? this.muted,
    line: line ?? this.line,
    field: field ?? this.field,
    primaryInk: primaryInk ?? this.primaryInk,
    nav: nav ?? this.nav,
    navInk: navInk ?? this.navInk,
    navMuted: navMuted ?? this.navMuted,
    warning: warning ?? this.warning,
    warningBg: warningBg ?? this.warningBg,
    danger: danger ?? this.danger,
    success: success ?? this.success,
    successBg: successBg ?? this.successBg,
  );

  @override
  R360Colors lerp(R360Colors? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return R360Colors(
      canvas: l(canvas, other.canvas),
      surface: l(surface, other.surface),
      surface2: l(surface2, other.surface2),
      ink: l(ink, other.ink),
      muted: l(muted, other.muted),
      line: l(line, other.line),
      field: l(field, other.field),
      primaryInk: l(primaryInk, other.primaryInk),
      nav: l(nav, other.nav),
      navInk: l(navInk, other.navInk),
      navMuted: l(navMuted, other.navMuted),
      warning: l(warning, other.warning),
      warningBg: l(warningBg, other.warningBg),
      danger: l(danger, other.danger),
      success: l(success, other.success),
      successBg: l(successBg, other.successBg),
    );
  }
}

extension R360ColorsContext on BuildContext {
  /// Colores del tema activo (con respaldo si el árbol no usa nuestro tema, p. ej. en pruebas).
  R360Colors get colors {
    final theme = Theme.of(this);
    return theme.extension<R360Colors>() ?? (theme.brightness == Brightness.dark ? R360Colors.dark : R360Colors.light);
  }
}

ThemeData buildLightTheme() => _build(R360Colors.light, Brightness.light);
ThemeData buildDarkTheme() => _build(R360Colors.dark, Brightness.dark);

/// Compatibilidad: tema claro.
ThemeData buildTheme() => buildLightTheme();

ThemeData _build(R360Colors c, Brightness brightness) {
  final scheme = ColorScheme.fromSeed(
    seedColor: Brand.teal,
    brightness: brightness,
    primary: Brand.teal,
    onPrimary: Brand.night,
    secondary: Brand.lime,
    onSecondary: Brand.night,
    surface: c.surface,
    onSurface: c.ink,
    error: c.danger,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    extensions: [c],
    scaffoldBackgroundColor: c.canvas,
    textTheme: ThemeData(brightness: brightness).textTheme.apply(bodyColor: c.ink, displayColor: c.ink),
    appBarTheme: AppBarTheme(backgroundColor: c.canvas, foregroundColor: c.ink, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(
      color: c.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: c.line),
      ),
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
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: c.ink,
        minimumSize: const Size.fromHeight(48),
        side: BorderSide(color: c.field),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: c.primaryInk)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.field),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.field),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: c.primaryInk, width: 2),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        selectedBackgroundColor: Brand.lime,
        selectedForegroundColor: Brand.night,
        foregroundColor: c.ink,
        side: BorderSide(color: c.field),
        // Etiquetas en una sola línea en pantallas angostas.
        textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        padding: const EdgeInsets.symmetric(horizontal: 8),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: c.surface,
      indicatorColor: Brand.lime,
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? Brand.night : c.muted)),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: s.contains(WidgetState.selected) ? c.ink : c.muted),
      ),
    ),
  );
}
