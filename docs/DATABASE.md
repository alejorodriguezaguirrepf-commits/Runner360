# Base de datos — RUNNER 360

PostgreSQL (Supabase). Migraciones en `supabase/migrations` (orden por timestamp). Seeds en `supabase/seed`.

## Convenciones
- Distancias en **metros enteros**, duraciones en **segundos enteros**, dinero en **unidades menores** (`bigint`)
  + moneda ISO; volúmenes en **ml enteros**. Sin punto flotante persistido para estos valores.
- `timestamptz` para instantes, `date` para fechas de calendario. `created_at`/`updated_at` con trigger.
- Todas las tablas de `public` tienen RLS habilitado y privilegios explícitos.

## Entidades

| Tabla | Propósito | Acceso |
|---|---|---|
| `profiles` | Datos de cuenta (nombre visible, fecha de nacimiento, zona horaria, onboarding) | Titular; admin lectura. Columnas editables limitadas por GRANT |
| `user_roles` | Roles `user`/`coach`/`admin` (separado del perfil) | Titular lectura; admin gestión (auditado) |
| `user_consents` | Consentimientos versionados, solo inserción | Titular |
| `audit_logs` | Auditoría de acciones administrativas | Admin lectura; escritura solo por triggers/funciones |
| `training_profiles` | Perfil deportivo (objetivo, nivel, disponibilidad, marca) | Titular; admin lectura |
| `training_health_info` | Antecedentes de salud | **Solo el titular**, y solo con consentimiento vigente |
| `training_plans` | Plan (distancia, nivel, tipo, demo) | Catálogo publicado; escritura staff |
| `training_plan_versions` | Versiones con estado y validación | Publicadas visibles; inmutables fuera de borrador |
| `training_plan_weeks` / `training_sessions` / `training_session_exercises` | Contenido de una versión | Lectura según acceso; escritura solo en borrador |
| `user_training_plans` | Plan asignado (versión, inicio, patrón de días) | Titular |
| `user_training_calendar` | Sesiones fechadas del usuario | Titular; FK compuesta asegura propiedad |
| `workout_logs` / `workout_splits` | Entrenamientos registrados y parciales | Titular |
| `hydration_logs` / `hydration_reminders` | Hidratación | Titular; escritura requiere feature `hydration` |
| `competitions` / `competition_results` / `competition_result_splits` | Objetivos y resultados reales | Titular; escritura requiere feature `competitions` |
| `personal_bests` (vista, security_invoker) | Mejor resultado real por distancia | Titular |
| `subscription_products` / `subscription_prices` | Catálogo y precios administrables | Lectura pública de activos; admin escritura |
| `subscriptions` / `subscription_events` | Suscripciones e historial de estados | Titular lectura; escritura solo service_role o RPC admin |
| `payment_events` | Eventos de proveedores (idempotencia por `(provider, provider_event_id)`) | Admin lectura; escritura service_role |
| `educational_contents` | Contenido educativo (free/premium) | Publicado visible; staff escritura |
| `incident_reports` | Reportes de usuarios | Titular crea/lee; admin gestiona |
| `account_deletion_requests` | Solicitudes de baja cuando no hay clave de servicio | Titular / admin |

> Cambio respecto al listado inicial: se agregaron `user_roles`, `training_health_info`, `subscription_prices`,
> `subscription_events`, `competition_result_splits`, `incident_reports` y `account_deletion_requests` para separar
> responsabilidades (seguridad de roles, datos sensibles, historial de precios) y cubrir requisitos explícitos.

## Reglas en la base
- **Inmutabilidad de versiones** (`enforce_plan_version_rules`): solo `draft` es editable; transiciones
  `draft→in_review→approved→published→archived` (y retrocesos a borrador antes de publicar).
  Aprobar: coach/admin. Publicar/archivar: admin. Publicar exige DEMO marcado `demo_unvalidated` o
  `validated` + `approved_at`, y semanas/sesiones completas según lo declarado.
- **Semanas/sesiones/ejercicios** solo se modifican si la versión está en borrador.
- **Calendario**: la sesión debe pertenecer a la versión del plan asignado (`enforce_calendar_session`).
- **Un plan activo por usuario** (índice único parcial). Iniciar uno nuevo abandona el anterior (historial intacto).
- **Ritmo** calculado en la base (`avg_pace_s_per_km`, columna generada, nunca divide por cero).
- **Suscripciones**: historial automático (`track_subscription_status`); `has_feature()` resuelve permisos.
- **Altas**: `handle_new_user` crea perfil y rol; `handle_signup_consents` registra términos/privacidad aceptados.

## Funciones RPC
`start_training_plan` (invoker, transaccional), `has_feature`, `my_features`, `has_consent`, `is_admin`, `is_staff`,
`admin_business_stats`, `admin_set_role`, `admin_grant_subscription`, `admin_cancel_subscription`.

## Seeds
- `00_products.sql`: productos Free y Premium; precio Premium USD 7,99/mes. ARS y anual: pendientes.
- `10_demo_plans.sql`: generado por `pnpm seed:generate`; 16 versiones DEMO publicadas mediante el flujo de estados.
- `20_educational_content.sql`: 3 contenidos educativos iniciales (borrador editorial).
Todos son idempotentes (verificado por `scripts/verify-db.sh`).

## Tipos para TypeScript
Cuando haya un proyecto Supabase: `supabase gen types typescript --local > apps/web/src/lib/database.types.ts`
y tipar los clientes. Hoy las filas se mapean explícitamente en `src/lib/data/*`.
