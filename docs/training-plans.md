# Biblioteca de planes de running

18 planes (5 km, 10 km, 21,1 km y 42,195 km), 324 semanas y 1.632 sesiones de carrera programadas día por día.

| Capítulo | Distancia | Nivel | Duración | Días/semana | Planes |
|---|---|---|---|---|---|
| 1 | 5 km | Principiante | 4 y 12 semanas | 3, 4 y 5 | 1–6 |
| 2 | 10 km | Intermedio | 12 y 24 semanas | 3, 4 y 5 | 7–12 |
| 3 | 21,1 km | Avanzado | 12, 24 y 48 semanas | 6 | 13–15 |
| 4 | 42,195 km | Avanzado | 12, 24 y 48 semanas | 6 | 16–18 |

## Fuente de verdad

- `content/training-plans/running_plans_library.json` es la **única** fuente del contenido. El PDF de 244 páginas es una referencia editorial y no se parsea.
- **El contenido no se reescribe.** Sesiones, textos, intensidades, criterios y referencias se guardan y se muestran tal como vienen. Si se detecta un error, se reporta al líder técnico de entrenamiento y se corrige en el JSON con una `content_version` nueva.
- Las duraciones y distancias son **estimadas para un corredor modelo** (`model_runner_assumptions`). La interfaz siempre lo aclara: el corredor se guía por los minutos y la intensidad, no por los km.
- No hay ritmos absolutos: la intensidad se prescribe por RPE y prueba del habla.

## Código

| Ubicación | Qué hace |
|---|---|
| `packages/plan-library/src/schema.ts` | Esquema Zod **estricto** del JSON (rechaza campos desconocidos o faltantes). |
| `packages/plan-library/src/invariants.ts` | Invariantes del contenido, regla de "día exigente" y semana de competencia. |
| `packages/plan-library/src/import-sql.ts` | Validación + SQL de importación idempotente (solo servidor/CLI). |
| `packages/plan-library/scripts/` | CLI de importación y generador del seed. |
| `supabase/migrations/20261012000100_plan_library.sql` | Tablas, RLS, índices y reglas en la base. |
| `supabase/rollback/20261012000100_plan_library.down.sql` | Reversión de la migración (manual, con autorización). |
| `supabase/seed/40_plan_library.sql` | Seed **generado** con la biblioteca (no editar a mano). |
| `scripts/db/migrate.mjs` | Migrador: aplica migraciones y seeds pendientes en cualquier base. |

## Modelo de datos

El **catálogo** (contenido) está separado del **estado del usuario**. Todo el catálogo tiene como clave la `content_version`: una versión nueva convive con la anterior y las inscripciones existentes conservan la suya.

### Catálogo (solo lectura, inmutable)

| Tabla | Clave | Contenido |
|---|---|---|
| `library_versions` | `content_version` | Huella (sha256), versión vigente (`is_current`) y textos globales tal cual: `safety`, `load_monitoring`, `practical_rules`, `individual_adaptation`, `glossary`, `bibliography` (= `references`), `model_runner_assumptions`, `category_legend`, `zone_map`. |
| `library_intensities` | versión + nombre | Las 6 intensidades con RPE, prueba del habla y sensación. |
| `library_session_types` | versión + código | Catálogo de sesiones (`CC`, `R`, `UMB`, …). |
| `library_strength_exercises` | versión + rutina + posición | Rutinas de fuerza A, B y C. |
| `library_plans` | versión + `plan-01…plan-18` | Ficha: distancia, nivel, duración, días, requisitos, objetivos, fases, notas, validación y `race_week` (semana de la competencia objetivo). |
| `library_weeks` | versión + plan + semana | Fase, tipo de semana, objetivo, criterio de progresión y totales. |
| `library_days` | versión + plan + semana + `day_index` | 7 por semana (0 = lunes … 6 = domingo), con descansos y fuerza sola. En las sesiones: código, categoría, calentamiento, parte principal, vuelta a la calma, duración y distancia estimadas, intensidad, observaciones, fuerza después y si es de calidad. |

- Un trigger impide modificar el contenido importado; solo se puede cambiar qué versión es la vigente.
- Duraciones y distancias del catálogo se guardan como `numeric` exactamente como vienen (decisión: no convertir a metros/segundos para no alterar el contenido). Los registros del usuario sí usan la convención del repo (metros y segundos enteros).

### Usuario (RLS: cada persona ve solo lo suyo; el staff puede leer)

| Tabla | Contenido |
|---|---|
| `plan_enrollments` | Plan + `content_version` congelada, inicio (lunes), fecha de competencia (domingo de la semana RACE), `day_map` (mover días) y estado (`active`, `paused`, `completed`, `cancelled`). Una abierta por persona. |
| `weekly_checkins` | Semana evaluada, si cumplió el criterio, qué recomendó el motor (y qué reglas), qué decidió la persona y desde cuándo y con qué semana sigue el plan. |
| `workout_logs` (columnas nuevas, opcionales) | `enrollment_id`, `plan_week`, `plan_day_index`, `pain_score` (0–10), `red_flags` (cojera, dolor óseo, hinchazón, dolor nocturno) y `sleep_quality`. Duración y distancia reales, RPE y notas usan las columnas existentes. |

Los datos de salud (`pain_score`, `red_flags`, `sleep_quality`, notas) son sensibles: nunca se escriben en logs y la persona puede borrarlos.

### Índices para las consultas reales

- **Filtro del catálogo:** `library_plans (content_version, distance_km, level, duration_weeks, days_per_week)`.
- **Sesión de hoy / semana actual:** `plan_enrollments (user_id) where status in ('active','paused')` (única), `weekly_checkins (enrollment_id, week_start)` y `workout_logs (enrollment_id, workout_date)`.
- El día de una semana se lee por la clave primaria de `library_days`.

### Reglas que también controla la base

- La fecha de competencia tiene que coincidir con el domingo de la semana `RACE` del plan.
- `day_map` tiene que ser una permutación de los 7 días, no puede dejar dos sesiones exigentes en días consecutivos (tampoco de domingo a lunes) y no puede mover la competencia de su día.
- Una inscripción no cambia de plan, versión ni fechas; los registros y check-ins solo pueden apuntar a inscripciones propias.

## Pantallas

| Ruta | Qué muestra |
|---|---|
| `/planes` | Catálogo con filtros en orden distancia → nivel → duración → días. Un paso con una sola opción se elige solo (el nivel de cada distancia; los 6 días de 21,1 y 42,195 km): se llega al plan en 3–4 toques. Los filtros viajan en la URL (`?d=10&s=24&dias=4`). |
| `/planes/[id]` | Ficha (perfil, requisitos, objetivos, semana tipo, semana de competencia), fases, vista rápida de todas las semanas (grilla de 7 columnas por categoría, siempre con texto), totales semanales, una semana día por día con todas las columnas (`?semana=N`, una por vez), escala de intensidad, rutina de fuerza, notas y validación técnica (colapsables). |
| `/planes/elegir` | Asistente "¿Cuál es mi plan?" (evaluación inicial). Con `?plan=plan-NN` evalúa además ese plan. Precarga lo que ya está en el perfil de corredor. |

En todas: aclaración de valores estimados (`model_runner_assumptions.note`) y avisos de `safety`.
Después del onboarding se llega al asistente; `/plan` e `/inicio` sin plan activo llevan a la biblioteca (los planes DEMO ya no se ofrecen; quien tenga uno activo lo sigue viendo).

Textos de interfaz: `apps/web/src/i18n/es-AR/library.ts` (diccionario tipado; ningún texto de interfaz de la biblioteca está fijo en los componentes). El contenido de los planes no pasa por el diccionario.

## Recomendación y requisitos de ingreso

- `planRequirements` clasifica cada texto de `entry_requirements` y toma los umbrales que el propio texto declara (minutos continuos, km de tirada larga, volumen semanal, días, experiencia, marca reciente, media maratón/maratón previa, lesión activa, consulta médica). El texto se muestra siempre tal cual. Un test exige que los 18 planes queden totalmente clasificados y que el volumen del texto coincida con `min_weekly_km`.
- `recommendPlan` (puro, con tests):
  - lesión activa o consulta médica pendiente → no recomienda ningún plan;
  - frecuencia: la mayor que entra en los días disponibles; con lesiones por sobrecarga, la más baja (`individual_adaptation`);
  - entre los planes cuyos requisitos se cumplen y cuya fecha alcanza, el **más largo** (progresión más gradual);
  - si los requisitos se cumplen pero no hay tiempo hasta la carrera → sugiere el plan posible y su primera fecha de competencia;
  - si no se cumplen → muestra lo que indica el contenido: la nota del plan ("Si la persona no cumple…", p. ej. hacer antes las semanas 1–4 del plan de 3 meses) y, por volumen bajo, la adaptación "Volumen actual menor que el requisito".
- Marca reciente: si falta y el plan admite el test de 30', queda como paso "antes de empezar" (no bloquea).
- Las respuestas del asistente (incluidas las de salud) **no se guardan**: solo se usan para calcular la recomendación.

## Fechas

- Día de la semana 0 = lunes … 6 = domingo (como `day_index`). Los planes empiezan un lunes (hoy si es lunes, si no el lunes siguiente).
- Competencia = domingo de la semana `RACE`: `inicio + (race_week − 1) × 7 + 6`. Con fecha de carrera se calcula el inicio; si ese lunes ya pasó, no hay tiempo suficiente.

## Invariantes (si alguno falla, la importación se aborta)

- `plans.length` = 18 y los ids son `plan-NN` según su número.
- Semanas del plan = `duration_weeks`, numeradas de 1 en adelante.
- 7 días por semana, en orden de lunes a domingo.
- Sesiones de carrera por semana = `days_per_week` = `totals.running_sessions`.
- Suma de `distance_km_est` del día = `totals.distance_km_est` (±0,1) y suma de minutos = `totals.duration_min_est` (±0,5).
- Exactamente una semana `RACE` por plan; `includes_race` coincide con el calendario.
- Códigos de sesión e intensidades existentes en el catálogo; no hay dos sesiones exigentes en días consecutivos.

## Cómo actualizar el contenido

1. Reemplazá `content/training-plans/running_plans_library.json` y **subí `content_version`** (por ejemplo, `2026.10` → `2026.11`). Una versión ya importada nunca cambia: si el contenido difiere y la versión es la misma, la importación aborta.
2. `pnpm plans:check`: valida el esquema y los invariantes.
3. `pnpm seed:generate`: regenera `supabase/seed/40_plan_library.sql` y `supabase/nube/3-biblioteca-planes.sql`.
4. Si cambian los totales a propósito, actualizá `packages/plan-library/test/golden-totals.json` y explicalo en el PR.
5. `pnpm test` y `pnpm db:test`.
6. Al llegar a `main`, la base de producción se actualiza sola (ver abajo). La versión nueva pasa a ser la vigente para las inscripciones nuevas; las existentes siguen con la suya.

Importación manual en una base (por ejemplo, para probar): `DATABASE_URL=postgresql://… pnpm plans:import`.

## Cómo llega a producción

- `pnpm db:migrate` (`scripts/db/migrate.mjs`) aplica las migraciones y seeds pendientes y los registra en `runner360_meta.schema_migrations`. Solo avanza, cada archivo en su transacción, con un bloqueo para que no corran dos a la vez.
- El workflow **Actualizar base de datos** (`.github/workflows/db-migrate.yml`) lo corre después de que la CI termina bien en `main`. Necesita el secreto `SUPABASE_DB_URL` en GitHub; sin el secreto avisa y no hace nada.
- Para bases instaladas antes de este registro, el migrador toma como línea de base lo que ya existe.
- Reversión: `supabase/rollback/20261012000100_plan_library.down.sql`. Borra inscripciones, check-ins y datos de salud de los registros: solo con autorización explícita.

## Decisiones

| Decisión | Motivo |
|---|---|
| Tablas nuevas para el catálogo en lugar de extender `training_plans` | El modelo existente es para escribir planes dentro de la app (borrador → revisión → publicación), limita a 24 semanas, usa otra escala de intensidad y no guarda descansos. La biblioteca es contenido importado e inmutable. Las tablas existentes no se tocaron. |
| Registros en `workout_logs` (columnas opcionales) | Progreso, exportación de datos y eliminación de cuenta siguen funcionando sin duplicar registros (aprobado). |
| Planes DEMO | Se reemplazan por la biblioteca en el catálogo (aprobado). Los datos DEMO no se borran. |
| Contenido numérico como `numeric` | Fidelidad al JSON; la convención de enteros se mantiene para datos del usuario. |
| Semanas gratis configurables | `library_settings.free_preview_weeks` (1 por defecto) y la función `plan_library` en `app_features`; nada fijo en el código. La ficha y los totales semanales son públicos; el detalle día por día después de las semanas gratis requiere Premium. |
| Calendario calculado, no guardado | Las fechas salen de la inscripción y los check-ins. Repetir una semana desplaza el calendario sin reescribir filas. |
| Analítica | El repo no tiene capa de analítica; no se envían eventos. |
| Catálogo dentro del área privada | Requiere sesión (como el resto de la app). La ficha es pública en la base (RLS), así que se puede abrir sin sesión más adelante sin cambiar datos. |
| Semanas bloqueadas en la vista rápida | Se resumen en una fila; sus totales (públicos) quedan en una lista colapsable. |
| App móvil | Sigue con el flujo anterior (planes DEMO) hasta que se migre; la biblioteca es solo web en esta etapa. |
| Trabajo en PR | El pedido de integración pide PR pequeños y CLAUDE.md dice "push directo a main": se trabaja en PR que se mergean a `main` cuando están en verde (aprobado). |
