# Base de datos — RUNNER 360

PostgreSQL (Supabase). Migraciones en `supabase/migrations`, en orden:

| Migración | Contenido |
|---|---|
| `…0100_core.sql` | tipos base, `set_updated_at`, `profiles`, helpers de rol, `user_consents`, `audit_logs` |
| `…0200_runner_profile_and_billing.sql` | `training_profiles`, `health_screenings`, productos, precios, suscripciones, eventos, `payment_events`, `has_premium` |
| `…0300_training_plans.sql` | catálogo y versiones de planes, semanas, sesiones, ejercicios, variantes, inscripciones, calendario, funciones de ciclo de vida |
| `…0400_activity_and_content.sql` | entrenamientos y parciales, competencias, resultados, hidratación, contenidos, incidencias, estadísticas admin |
| `…0500_premium_features.sql` | `app_features` y control Premium en RLS |

## Convenciones

- Claves primarias `uuid` (`gen_random_uuid()`), salvo logs (`bigint identity`).
- `created_at` / `updated_at` con trigger `set_updated_at`.
- Distancias en **metros** (`integer`), duraciones en **segundos** (`integer`), volumen en **ml**, dinero en **centavos** (`bigint amount_minor` + `currency`).
- `workout_logs.avg_pace_s_per_km` es columna generada (`numeric(8,2)`), nunca la envía el cliente.
- Restricciones `CHECK` para rangos (FC 30–250, RPE 1–10, km semanales 0–300, etc.).

## Entidades (equivalencias con el pedido original)

| Pedido | Implementación |
|---|---|
| profiles | `profiles` (rol, permiso de validación, zona horaria, onboarding, solicitud de baja) |
| training_profiles | `training_profiles` + `health_screenings` (datos sensibles separados) |
| training_plans / versions / weeks / sessions / exercises | `training_plans`, `training_plan_versions`, `training_plan_weeks`, `training_sessions`, `training_session_exercises` |
| (variantes por disponibilidad) | `training_plan_schedule_variants` |
| user_training_plans / calendar | `user_training_plans`, `user_training_calendar` |
| workout_logs / splits | `workout_logs`, `workout_splits` |
| hydration_logs / reminders | `hydration_logs`, `hydration_reminders` |
| competitions / results | `competitions`, `competition_results`, `competition_splits`, vista `personal_records` |
| subscriptions / products / payment_events | `subscriptions`, `subscription_products`, `product_prices`, `subscription_events`, `payment_events` |
| educational_contents | `educational_contents` |
| user_consents / audit_logs | `user_consents` (historial inmutable), `audit_logs` |
| (incidencias) | `incident_reports` |
| (funciones Premium) | `app_features` |

## Ciclo de vida de planes

`draft → in_review → published → archived` (y `in_review → draft`). Controlado por el trigger `guard_plan_version`:

- Contenido (semanas, sesiones, ejercicios, variantes) solo editable en `draft` (`guard_plan_child`).
- Una versión publicada/archivada solo puede cambiar `status`/`archived_at`.
- Publicar exige: administrador, 8–24 semanas, todas las semanas y sesiones cargadas, parte principal y criterios de suspensión en sesiones activas, al menos una variante válida y —si no es DEMO— firma de un validador con `can_validate_plans`.
- Funciones: `clone_plan_version`, `sign_off_plan_version`, `publish_plan_version` (archiva la anterior en la misma transacción). Todas auditadas.

## Funciones de seguridad

`is_admin()`, `is_staff()`, `current_role_name()`, `has_consent()`, `has_premium()`, `can_use_feature()`, `can_read_plan_content()` — todas `SECURITY DEFINER` con `search_path = ''`.

## Seeds

| Archivo | Tipo |
|---|---|
| `seed/10_products.sql` | configuración inicial (Free, Premium mensual con USD 7,99, Premium anual sin precio) |
| `seed/20_demo_plans.sql` | **DEMO / NO VALIDADO**, generado con `pnpm seed:generate` — 15 planes, IDs deterministas, idempotente |
| `seed/30_educational_content.sql` | 3 artículos orientativos sin revisión profesional |

## Pruebas

`pnpm db:test` crea un PostgreSQL efímero, aplica `supabase/tests/00_supabase_shim.sql` (roles y `auth.uid()` como en Supabase), migraciones, seeds y ejecuta `supabase/tests/[1-9]*.sql`: aislamiento entre usuarios, escalamiento de privilegios, inmutabilidad, versionado, Premium, consentimientos y auditoría.

## Tipos TypeScript

`packages/shared/src/db.ts` contiene tipos de filas escritos a mano. Con un proyecto vinculado, reemplazarlos por `supabase gen types typescript --linked`.
