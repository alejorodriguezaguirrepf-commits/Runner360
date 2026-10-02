/// Configuración por `--dart-define` (nunca se incluyen secretos en el código).
///
/// flutter run \
///   --dart-define=SUPABASE_URL=https://PROYECTO.supabase.co \
///   --dart-define=SUPABASE_ANON_KEY=CLAVE_PUBLICABLE \
///   --dart-define=API_BASE_URL=https://DOMINIO_WEB
///
/// La clave de servicio de Supabase NUNCA debe usarse en la app.
class AppConfig {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  static const apiBaseUrl = String.fromEnvironment('API_BASE_URL');

  static bool get isConfigured => supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}
