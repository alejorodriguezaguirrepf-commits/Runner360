# Motor de entrenamiento — `@runner360/training-engine`

Módulo TypeScript puro y determinista. No depende de React, Flutter ni Supabase. Pruebas: `pnpm --filter @runner360/training-engine test`.

## Módulos

| Archivo | Responsabilidad |
|---|---|
| `model.ts` | Esquemas Zod del plan: versión, semanas, sesiones, ejercicios, variantes de días, requisitos de ingreso, reglas de progresión |
| `validation.ts` | `validatePlanVersion`: errores bloqueantes y advertencias (p. ej. aumento de carga > regla configurada) |
| `selection.ts` | `selectPlan`, `matchSchedule`, `meetsEntryRequirements`, `computeStart` |
| `calendar.ts` | `generateCalendar`, `planWeekForDate` |
| `metrics.ts` | Ritmo, velocidad, totales semanales/mensuales por zona horaria, cumplimiento, consistencia, marcas personales |
| `pace-calculator.ts` | Ritmo objetivo, tiempo final y parciales parejos (siempre rotulados como estimación) |
| `progression.ts` | `evaluateWeek`: **sugerencias** (continuar, repetir semana, consultar entrenador). Nunca modifica el plan |
| `versioning.ts` | Transiciones de estado, `cloneAsDraft`, `canPublish` |
| `ai.ts` | Punto de extensión: propuestas de IA → borrador + validación + aprobación humana |
| `demo/templates.ts` | Generador de planes **DEMO / NO VALIDADO** (15 combinaciones + fase introductoria) |

## Reglas de selección (en orden)
1. Se consideran solo versiones `published`.
2. Lesión reciente o condición médica → `professional_review_required` (si el plan exige revisión de salud).
3. Sin plan para distancia + nivel → `no_plan_available`.
4. Se toma la versión más reciente; si no cumple requisitos de ingreso (km semanales, meses de experiencia)
   → `introductory_recommended` (fase introductoria, no un plan exigente).
5. Plan Premium sin acceso → `premium_required`.
6. Sin un patrón de días **validado** contenido en la disponibilidad del usuario → `needs_schedule_configuration`.
   El motor no inventa distribuciones ni sesiones.
7. Con competencia: la última semana se alinea con la semana de la carrera; si faltan semanas, solo se pueden omitir
   las iniciales hasta `maxSkippableWeeks`; si no alcanza → `insufficient_time`.

## Calendario
La semana `startWeek` empieza en `startDate` (lunes). Cada sesión tiene un `daySlot` (orden dentro de la semana) que la
variante traduce a un día ISO (1 = lunes). Ejemplo: patrón `[2,4,6]` → martes, jueves, sábado.

## Versionado
- Un cambio sobre una versión publicada se hace con `cloneAsDraft` → versión N+1 en borrador.
- Los usuarios conservan la versión con la que comenzaron (el calendario referencia sesiones de esa versión, que es inmutable).
- Publicar requiere `canPublish`: estado aprobado, validación estructural sin errores y validación profesional
  (o identificación DEMO). La base de datos vuelve a exigir lo mismo con triggers.

## Reglas de progresión configurables (por versión)
`minWeeklyCompliance`, `rpeOverTargetMargin`, `rpeOverTargetSessions`, `maxWeeklyLoadIncreasePct`, `maxSkippableWeeks`.

## Planes DEMO
Generados por `buildAllDemoPlans()` y exportados a SQL con `pnpm seed:generate`. Son conservadores (por tiempo,
intensidad mayormente suave, descarga cada 4 semanas, reducción final). Las pruebas verifican que pasen la validación
sin advertencias (incluida la regla de aumento de carga ≤ 10% respecto del máximo de las 3 semanas previas).
**No son prescripciones**: deben reemplazarse por planes cargados y validados por el responsable metodológico.

## Paridad con Flutter
`fixtures/pace-vectors.json` contiene vectores de ritmo, velocidad, formato y parseo usados por Vitest y por
`flutter test`. Si cambia una regla, se actualiza el JSON y ambas suites deben pasar.
