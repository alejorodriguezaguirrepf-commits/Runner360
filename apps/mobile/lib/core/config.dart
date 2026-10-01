/// Configuración por `--dart-define`. Nunca incluir la clave de servicio de Supabase en la app.
///
/// flutter run \
///   --dart-define=SUPABASE_URL=https://xxxx.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=CLAVE_PUBLICA \
///   --dart-define=API_BASE_URL=https://app.runner360.example
class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  /// URL de la app web (Next.js), que expone la API de negocio (p. ej. inicio de plan).
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static bool get isConfigured =>
      supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}
