# Seguridad y privacidad — RUNNER 360

> Documento técnico inicial. No reemplaza una auditoría de seguridad ni asesoramiento legal.

## Modelo de amenazas cubierto

| Riesgo | Mitigación |
|---|---|
| Acceso horizontal (ver/editar datos de otro usuario) | RLS en todas las tablas privadas con `user_id = auth.uid()`; triggers verifican pertenencia en calendario, parciales y resultados; pruebas SQL dedicadas |
| Escalamiento de privilegios | Trigger `guard_profile_privileges`: solo administradores cambian `role`/`can_validate_plans`; un admin no puede quitarse su propio rol; cambios auditados |
| Acceso a administración | `requireAdmin()` en layout y en cada Server Action + políticas `is_admin()` en la base |
| Autoasignación de Premium | `subscriptions` sin políticas de escritura para usuarios; solo `service_role` (webhooks) o admin con `provider = 'manual'` |
| Manipulación de planes publicados | Inmutabilidad por trigger; publicación con criterios verificados en la base y en el motor |
| Webhooks falsificados / repetidos | Firma HMAC (Stripe: `t.payload` con tolerancia de 5 min; Mercado Pago: manifiesto `id;request-id;ts`) con comparación en tiempo constante; idempotencia por `(provider, provider_event_id)`; Mercado Pago se consulta a su API (no se confía en el cuerpo) |
| Fuerza bruta en autenticación | Limitador por IP en registro (5/10 min), ingreso (10/10 min), recuperación (5/10 min); además los límites propios de Supabase Auth |
| Redirección abierta | `safeNext()` acepta solo rutas internas |
| Exposición de secretos | `SUPABASE_SERVICE_ROLE_KEY` y claves de pago solo en `env.server.ts` (`import "server-only"`); `.env*` en `.gitignore`; la app móvil usa solo la clave publicable |
| Datos personales en logs | `logError()` elimina correos, JWT y UUID antes de escribir |
| XSS en contenidos | El Markdown se renderiza con un parser mínimo que no interpreta HTML (React escapa todo) |
| Validación solo en cliente | Zod en Server Actions/API + `CHECK` y triggers en PostgreSQL |

## Sesiones

Supabase SSR con cookies `httpOnly` gestionadas por `@supabase/ssr`. `proxy.ts` refresca el token y valida con `auth.getUser()` (no confía en la cookie sin verificar). La API móvil valida el `Bearer` contra Supabase Auth en cada solicitud.

## Datos sensibles y consentimientos (Ley 25.326)

- Antecedentes de salud en `health_screenings`, separados del perfil deportivo. Solo los ve su titular (ni administradores ni entrenadores). Insertar/actualizar requiere consentimiento `health_data` vigente (verificado en RLS).
- `user_consents` es un historial inmutable (se agregan filas). Términos y privacidad se registran al completar el onboarding con la versión del documento.
- Revocar el consentimiento de salud borra los antecedentes.
- **Ubicación**: no se recopila (ni en primer ni en segundo plano). Cualquier GPS futuro requiere consentimiento `location` específico.
- Minimización: el panel admin no muestra correos (están en Supabase Auth); las estadísticas de negocio son agregadas.

## Derechos del titular

- **Acceso / portabilidad**: `GET /api/account/export` (JSON con todos los datos del usuario, limitado a 5/hora).
- **Supresión**: “Eliminar mi cuenta” borra el usuario de Auth (cascada sobre todos sus datos) usando `service_role`. Sin esa clave se registra `deletion_requested_at` y se informa que la baja se procesará manualmente.
- **Rectificación**: perfil y perfil deportivo editables.

## Pendientes antes de producción

1. Revisión legal de términos, privacidad y transferencia internacional de datos (región del proyecto Supabase).
2. Limitador de solicitudes compartido (Redis/Upstash o tabla) si hay más de una instancia.
3. Encabezados de seguridad (CSP, HSTS) en el hosting y revisión de `next.config`.
4. Monitoreo de errores (Sentry u otro) conectado a `lib/log.ts`.
5. Política de retención y borrado de `payment_events`/`audit_logs`.
6. Auditoría externa de RLS y pruebas de penetración.
7. MFA para administradores (Supabase Auth MFA).
8. Validación de compras en tiendas (App Store Server API / Google Play Developer API).
