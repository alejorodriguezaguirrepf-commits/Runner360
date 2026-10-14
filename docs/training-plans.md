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
| `plan_enrollments` | Plan + `content_version` congelada, inicio (lunes), fecha de competencia (domingo de la semana RACE), `day_map` (mover días), estado (`active`, `paused`, `completed`, `cancelled`) y marca reciente opcional (`mark_*`, migración `20261013000100`). Una abierta por persona. |
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
| `/planes` | Acceso directo, sin evaluación previa. Arriba, las dos opciones: **plan gratis** (la muestra de `free_preview_weeks`) o **suscripción mensual**. Pestañas **5 / 10 / 21 / 42 km** (la inicial es la distancia del perfil) → días por semana → duración del plan → nivel; un paso con una sola opción se elige solo. Con el plan definido: resumen, "Pensado para quien" (los `entry_requirements`, informativos) e inscripción (lunes de inicio entre los próximos 12 + confirmación de los avisos de seguridad). Los pasos viajan en la URL (`?d=10&dias=4&s=24&n=Intermedio`, o `?plan=plan-NN`). |
| `/planes/[id]` | Ficha (perfil, recomendaciones antes de empezar, objetivos, semana tipo, semana de competencia), fases, vista rápida de todas las semanas, totales semanales, una semana día por día (`?semana=N`), escala de intensidad, rutina de fuerza, notas y validación técnica. "Empezar este plan" lleva a `/planes?plan=plan-NN`. |
| `/planes/elegir` | Redirige a `/planes` (el asistente de evaluación se quitó). |
| `/plan` | Calendario de la inscripción: estado, inicio, competencia (y la proyectada si se repitieron semanas), ritmos de referencia (Riegel), la semana elegida con fechas reales y los 7 días, y la lista de todas las semanas. |
| `/plan/dias` | Mover días: qué día de la semana se hace cada día del plan. |
| `/hoy` | La sesión del día (calentamiento, parte principal, vuelta a la calma, intensidad con la escala RPE a un toque, observaciones), el registro post-sesión, el check-in semanal pendiente, el aviso de sesión perdida y la semana en curso. En pausa: avisos de seguridad y "Retomar". |

En todas: aclaración de valores estimados (`model_runner_assumptions.note`) y avisos de `safety`.
Después del onboarding se llega a `/planes`; `/plan` e `/inicio` sin plan activo llevan a la biblioteca (los planes DEMO ya no se ofrecen; quien tenga uno activo lo sigue viendo).

Textos de interfaz: `apps/web/src/i18n/es-AR/library.ts` (diccionario tipado; ningún texto de interfaz de la biblioteca está fijo en los componentes). El contenido de los planes no pasa por el diccionario.

## Suscripción y liberación mensual

- Cualquiera puede empezar un plan: sin suscripción ve la muestra gratuita (`library_settings.free_preview_weeks`, 1 por defecto).
- La suscripción es mensual con **débito automático** (Mercado Pago, suscripción `preapproval` con `frequency: 1 months`). Cada débito aprobado libera **un mes (4 semanas)** del plan en curso: los planes de 3, 6 o 12 meses se habilitan mes a mes.
- El webhook (`/api/webhooks/mercadopago`) procesa `subscription_preapproval` (alta, pausa, baja) y `subscription_authorized_payment` (cada débito): consulta el estado real a la API y registra el débito en `subscription_payments` (idempotente por `provider_payment_id`; un débito que cambia de estado se actualiza).
- `enrollment_open_weeks(inscripción)` = máx(muestra gratuita, 4 × meses pagos). Meses pagos = el mayor entre los débitos aprobados desde el mes anterior a la inscripción y, con la suscripción al día, el mes del plan en curso (cubre el primer débito aún no informado y los accesos anuales o manuales, que también se liberan mes a mes). Lo pagado queda liberado aunque después se cancele.
- Se aplica en RLS: `library_days_read` usa `library_day_is_open(versión, plan, semana)` (muestra gratuita, staff, función `plan_library` marcada como gratuita, o semanas liberadas de una inscripción propia a ese plan).
- `/suscripcion` explica el funcionamiento y lista los débitos ("Aprobado · mes liberado").

## Fechas

- Día de la semana 0 = lunes … 6 = domingo (como `day_index`). Los planes empiezan un lunes (hoy si es lunes, si no el lunes siguiente).
- Competencia = domingo de la semana `RACE`: `inicio + (race_week − 1) × 7 + 6`. Con fecha de carrera se calcula el inicio; si ese lunes ya pasó, no hay tiempo suficiente.

## Inscripción y calendario

- Una inscripción guarda: plan, `content_version` congelada, inicio (lunes), competencia (domingo de la semana `RACE`), `day_map` y, opcional, la marca reciente (distancia, tiempo, fecha; la inscripción desde `/planes` no la pide).
- Un solo plan en curso por persona (activa o en pausa). Al inscribirse, un plan DEMO activo del sistema anterior se cierra.
- **Calendario calculado** (`schedule.ts`): tramos a partir del inicio y de las decisiones de los check-ins (`repeat`/`reduce` vuelven a la misma semana, `regress` a una anterior, `pause` detiene, `resume` retoma). Repetir una semana desplaza el resto y la fecha proyectada de la competencia; la fecha de la carrera elegida no cambia y la pantalla avisa la diferencia.
- **Mover días**: `day_map` se aplica a todas las semanas. Regla: entre dos sesiones exigentes (`is_quality` o `thr`/`hard`/`race`) al menos un día fácil o de descanso, también de domingo a lunes; la competencia no se mueve. Se valida en el cliente (vista previa sobre las semanas visibles), en el servidor (todas las semanas, con `library_day_map_violations`) y en la base (trigger).
- **Fuerza** (`strength_after`, `strength_only`): se muestra como complementaria y nunca suma al tiempo de carrera.

## Registro, motor de reglas y check-in

- **Registro post-sesión** (`workout_logs`): cómo fue (hecha, con cambios, omitida), duración y distancia reales, RPE 1–10, dolor 0–10, señales de alarma (cojera, dolor óseo, hinchazón, dolor nocturno), sueño y notas. Una por día del plan; se puede editar. Dolor, señales y sueño requieren el consentimiento `health_data` (se pide en el mismo formulario) y nunca se escriben en los logs del servidor.
- **Motor de reglas** (`packages/plan-library/src/rules.ts`), declarativo: cada regla tiene id, la fuente del contenido (`load_monitoring` o `practical_rules`), una condición y una acción. El mensaje es siempre el texto del contenido; un test exige que todas las fuentes existan.

| Regla | Fuente | Condición | Recomendación |
|---|---|---|---|
| `pain_stop` | Dolor → suspender y consultar | dolor > 5 o cualquier señal de alarma | **pausa** (al registrar, se pausa en el acto) |
| `pain_reduce` | Dolor → reducir o repetir | dolor 3–5 | repetir con menos carga |
| `easy_rpe_high` | RPE de los rodajes Suaves | ≥ 2 rodajes Suaves/recuperación con RPE ≥ 5 en la semana ("de forma habitual") | repetir |
| `poor_sleep` | Sueño | dos noches malas seguidas | aviso (cambiar la calidad por un rodaje Suave) |
| `missed_one` | Sesión perdida | una sesión sin hacer | aviso: no se recupera al día siguiente |
| `missed_two` | Dos o más sesiones perdidas | ≥ 2 sin hacer | repetir |
| `missed_week` | Una semana perdida | 7–13 días sin entrenar | volver a la semana anterior |
| `two_weeks_off` | Dos semanas o más sin entrenar | ≥ 14 días | retroceder 2 semanas o a la última descarga (la más conservadora) |
| `criterion_twice` | Criterio no cumplido dos semanas seguidas | dos "no" seguidos | volver a la última descarga |

- Sin reglas disparadas: criterio cumplido → avanzar; no cumplido → repetir. Si se disparan varias, gana la más conservadora (pausa > retroceder > reducir > repetir > avanzar).
- **Check-in semanal**: aparece para la semana anterior sin check-in o, desde el sábado, para la actual. Muestra el `progression_criterion`; según la respuesta, la recomendación y los textos que la respaldan. La persona confirma una decisión permitida (con una recomendación conservadora no se ofrece avanzar; con pausa, solo pausar). El servidor recalcula la recomendación antes de guardar y registra recomendación, reglas y decisión en `weekly_checkins`.
- **Retomar** después de una pausa: desde la semana que indican las reglas prácticas según el tiempo sin entrenar. Se puede pausar y retomar en la misma semana (migración `20261013000200`: una sola revisión semanal por semana; pausas y reanudaciones libres).

## Progreso

En `/progreso`, con un plan en curso: por cada semana transcurrida, km y tiempo **planificados** (totales del contenido) contra **reales** (registros), sesiones hechas sobre vencidas, distribución Z1/Z2/Z3 planificada (`zone_pct`) y la de lo completado (minutos por intensidad que el contenido asigna a las sesiones hechas, vía `zone_map`; no se miden). Adherencia total = sesiones hechas / vencidas (`progress.ts`, función pura con tests).

## Ritmos de referencia (Riegel)

- `T2 = T1 × (D2/D1)^1,06` (`riegel.ts`, función pura con tests), solo con una marca de las últimas 8 semanas.
- Se muestran tiempo y ritmo (`mm:ss/km`) estimados para 5, 10, 21,1 y 42,195 km, siempre como estimación. En maratón, como **límite rápido, no objetivo**. El RPE y la prueba del habla siguen siendo la referencia principal; el contenido no define ritmos por intensidad y no se inventan.

## Monetización

- La ficha de cada plan y sus totales semanales son públicos. El detalle día por día de las semanas posteriores a `library_settings.free_preview_weeks` (1 por defecto) se libera mes a mes con la suscripción (ver "Suscripción y liberación mensual"). Se aplica en RLS (`library_day_is_open`), no solo en la interfaz.
- Ambos valores se cambian desde **Administración → Productos** (semanas gratis y "Biblioteca de planes" Premium/Gratis), sin tocar el código; el cambio queda en la auditoría.
- Una persona sin Premium puede inscribirse y hacer las semanas gratis; las siguientes muestran "Se libera con la suscripción".

## Seguridad y privacidad

- RLS en todas las tablas: el catálogo es de solo lectura; inscripciones, check-ins y registros son del titular (el staff puede leer, como el resto del dominio). Los registros y check-ins solo pueden apuntar a inscripciones propias.
- Validación de entrada en el servidor (Zod) en todas las acciones; la base repite las reglas críticas (fechas, mapeo de días, rangos).
- Datos de salud (dolor, señales, sueño, notas): requieren el consentimiento `health_data`; nunca se escriben en los logs (los errores solo registran el código); la persona los borra desde **Perfil → Datos de salud** (se conservan fecha, duración, distancia y RPE). Revocar el consentimiento también los borra.

## Accesibilidad y rendimiento

- WCAG AA: las categorías siempre llevan texto (abreviatura y leyenda) además del color, con contraste ≥ 5,2:1; tablas con `caption` y encabezados `scope`; filtros y opciones como grupos con `legend`; áreas táctiles de 44 px; navegación completa por teclado; sin desborde horizontal en 412 px.
- Catálogo, fichas, semanas y textos globales cacheados por `content_version` (contenido inmutable). El detalle día por día se pagina por semana: nunca se cargan 48 semanas de detalle juntas.
- LCP medido en local con emulación móvil (Pixel 7, red 1,6 Mbps / 150 ms, CPU ×4): `/planes` 0,80 s, `/planes/plan-18` 0,84 s, `/plan` 0,59 s (presupuesto: 2,5 s). En producción depende además de la región de Vercel y Supabase.

## Analítica

El repositorio no tiene una capa de analítica, así que **no se envían** `plan_viewed`, `plan_recommended`, `enrollment_started`, `session_logged`, `week_repeated` ni `plan_completed`. Cuando se agregue una, los puntos de envío son: ficha (`/planes/[id]`), `assessAction`, `enrollLibraryPlanAction`, `logPlanSessionAction`, `checkinAction` (decisión `repeat`/`reduce`) y el cierre del plan; nunca con datos de salud.

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

- **Contenido (automático en cada publicación):** antes de `next build`, Vercel corre `pnpm --filter @runner360/plan-library run sync` (`scripts/sync-rest.ts`). Con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (ya configuradas en Vercel) carga la `content_version` por la API de Supabase: solo inserta (`ON CONFLICT DO NOTHING`), no hace nada si ya está completa, no toca nada si la versión existe con otra huella y nunca hace fallar el build. Sin esas variables (CI, builds locales) se saltea.
- **Estructura (migraciones):** las aplica `pnpm db:migrate` (o el workflow, con el secreto `SUPABASE_DB_URL`). Las tres migraciones de la biblioteca ya se aplicaron en producción el 13/10/2026.

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
| Semanas gratis configurables | `library_settings.free_preview_weeks` (1 por defecto) y la función `plan_library` en `app_features`; nada fijo en el código. La ficha y los totales semanales son públicos; el detalle día por día después de las semanas gratis se libera de a 4 semanas por débito mensual. |
| Calendario calculado, no guardado | Las fechas salen de la inscripción y los check-ins. Repetir una semana desplaza el calendario sin reescribir filas. |
| Analítica | El repo no tiene capa de analítica; no se envían eventos (ver sección Analítica). |
| Catálogo dentro del área privada | Requiere sesión (como el resto de la app). La ficha es pública en la base (RLS), así que se puede abrir sin sesión más adelante sin cambiar datos. |
| Semanas bloqueadas en la vista rápida | Se resumen en una fila; sus totales (públicos) quedan en una lista colapsable. |
| App móvil | Sigue con el flujo anterior (planes DEMO) hasta que se migre; la biblioteca es solo web en esta etapa. |
| Trabajo en PR | El pedido de integración pide PR pequeños y CLAUDE.md dice "push directo a main": se trabaja en PR que se mergean a `main` cuando están en verde (aprobado). |
