# Seguridad y privacidad — RUNNER 360

## Autenticación y sesiones
- Supabase Auth (contraseñas gestionadas por GoTrue; la app nunca almacena contraseñas).
- Sesión en cookies httpOnly vía `@supabase/ssr`; el proxy refresca la sesión y valida con `getClaims()`.
- Verificación autoritativa en el servidor (`getUser()` en `requireViewer`) y en la base (RLS).
- Recuperación de contraseña sin enumeración de cuentas (mensaje genérico). Redirecciones internas validadas (`safeNext`).
- Contraseña mínima: 8 caracteres con letras y números (también configurar en Supabase).

## Autorización (defensa en profundidad)
1. **UI**: oculta acciones no permitidas.
2. **Servidor**: `requireStaff` / `requireAdmin` en páginas y server actions; Zod en todas las entradas.
3. **Base de datos**: RLS en todas las tablas, `GRANT` por columna (p. ej. el usuario no puede cambiar su email ni roles),
   triggers de reglas de negocio y funciones `SECURITY DEFINER` con `search_path = ''`.

Pruebas automatizadas (`supabase/tests/10_rls_test.sql`, 53 aserciones): acceso horizontal entre usuarios,
autoasignación de admin, datos de salud sin consentimiento, admin sin acceso a salud ni entrenamientos individuales,
inmutabilidad de planes publicados, coach sin permiso de publicar, suscripciones no autoasignables, anónimos sin acceso.

## Secretos
- Solo variables `NEXT_PUBLIC_*` llegan al navegador (URL y clave pública de Supabase).
- `SUPABASE_SECRET_KEY` (service_role), tokens de Mercado Pago y Stripe: solo servidor (`import "server-only"`).
- La app móvil usa únicamente la clave pública. `.env*` está en `.gitignore`.

## Pagos
- No se almacenan datos de tarjetas (checkout alojado por el proveedor).
- Webhooks: verificación de firma (Stripe `t/v1` con tolerancia de 5 min; Mercado Pago `x-signature` HMAC-SHA256),
  comparación en tiempo constante, límite de tamaño, idempotencia por `(provider, provider_event_id)` y reintento
  seguro de eventos fallidos. El estado de Mercado Pago se consulta a su API (fuente de verdad).
- El precio se lee de la base en el servidor, nunca del formulario.

## Limitación de solicitudes
- Ingreso, registro, recuperación, exportación, checkout, incidencias, webhooks y API móvil tienen límite.
- **Limitación conocida**: el limitador es en memoria (por instancia). En producción con varias instancias usar
  un almacén compartido (Redis/Upstash) y los límites propios de Supabase Auth.

## Registro de errores
- Se registran solo códigos de error (`db_error 23505`), nunca mensajes de Postgres que podrían incluir datos de la fila.

## Datos personales (Ley 25.326 Argentina y otras jurisdicciones)
- **Minimización**: solo se piden datos necesarios para planificar; la ubicación no se recopila.
- **Datos sensibles (salud)**: tabla separada, consentimiento expreso versionado, visible solo para el titular
  (ni administradores ni entrenadores), revocable (se borran los datos y se registra la revocación).
- **Acceso/portabilidad**: `/api/me/export` descarga un JSON con todos los datos propios.
- **Supresión**: eliminación de cuenta con cascada completa (requiere clave de servicio); si no está configurada,
  queda registrada la solicitud para procesarla.
- **Consentimientos** append-only con versión del documento.
- Los documentos de términos y privacidad son **borradores** sujetos a revisión legal (incluida la eventual
  inscripción de bases de datos ante la autoridad de control y requisitos de transferencias internacionales; para
  usuarios de la UE evaluar GDPR).

## Encabezados HTTP
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (sin geolocalización),
`Strict-Transport-Security`. Pendiente: Content-Security-Policy con nonces.

## Pendientes antes de producción
- Revisión de seguridad externa / pentest.
- CSP estricta, limitador distribuido, monitoreo (Sentry u otro con depuración de PII).
- Probar adaptadores de pago en sandbox con credenciales reales.
- Política de retención y procedimiento de procesamiento de bajas pendientes.
- Activar verificación de correo y protección contra contraseñas filtradas en Supabase Auth.
