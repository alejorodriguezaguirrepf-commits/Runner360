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

  /// Dominio público de la web (el mismo de NEXT_PUBLIC_SITE_URL): registro, planes y links.
  static const siteHost = String.fromEnvironment('SITE_HOST', defaultValue: 'runner360.vercel.app');
  static const siteUrl = 'https://$siteHost';

  static bool get isConfigured => supabaseUrl.startsWith('http') && supabaseAnonKey.length > 20;
}
