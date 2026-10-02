# Motor de entrenamiento — `@runner360/training-engine`

Lógica de negocio pura, determinista y sin dependencias de UI ni base de datos. Funciones puras siempre que es posible. Cubierto por 96 pruebas (`pnpm --filter @runner360/training-engine test`).

## Módulos

| Archivo | Responsabilidad |
|---|---|
| `schemas.ts` | Modelos Zod: distancias, niveles, tipos de sesión, intensidades, sesiones, semanas, variantes, requisitos de ingreso, reglas de progresión, versión de plan, perfil del corredor |
| `dates.ts` | Aritmética de fechas ISO en UTC (lunes de semana, edad, diferencias) |
| `pace.ts` | Ritmo (s/km), velocidad (km/h), tiempo por ritmo, ritmo objetivo, parciales parejos, parseo y formato de duraciones, km → metros |
| `readiness.ts` | Evaluación de seguridad: `ok`, `introductory_phase`, `professional_review` |
| `selection.ts` | Selección de versión publicada, requisitos de ingreso, semana inicial, asignación completa |
| `schedule.ts` | Resolución de variante por días disponibles, fecha de inicio (con o sin competencia), generación de calendario, semana en curso |
| `stats.ts` | Cumplimiento, totales semanales/mensuales, consistencia, días desde el último entrenamiento |
| `progression.ts` | Recomendación semanal: avanzar, avanzar con precaución, repetir semana, revisión profesional |
| `validation.ts` | Criterios de publicación (errores bloqueantes y advertencias) |
| `versioning.ts` | Transiciones de estado y numeración de versiones |
| `ai.ts` | Interfaz para proveedores de IA: solo propuestas sobre borradores, validadas y pendientes de aprobación humana |
| `demo/` | Generador de los 15 planes **DEMO / NO VALIDADOS** |

## Asignación (`assignPlan`)

1. `assessReadiness`: antecedentes declarados o edad < 18 → **revisión profesional**; distancia > 5K con < 5 km/semana, o nivel no principiante sin experiencia → **fase introductoria**. No se asigna plan.
2. `pickPublishedVersion`: misma distancia y nivel, solo `published`, prioriza versiones validadas sobre DEMO y la más nueva.
3. `unmetRequirements`: km semanales, meses de experiencia, edad mínima del plan.
4. `resolveScheduleVariant`: primera variante (por prioridad) cuyos días estén todos dentro de los disponibles. **Si no hay, se informa `needs_professional_configuration`; nunca se inventa una distribución.**
5. `determineStartWeek`: reglas `startWeekRules` del plan según km semanales.
6. `computeStartDate`: próximo lunes, o alineado para terminar en la semana de la competencia. Si no alcanza el tiempo → `insufficient_time` (no se comprime el plan).
7. `generateCalendar`: ubica cada sesión del plan en `lunes de la semana + (día de la variante − 1)`.

La capa de aplicación (`apps/web/src/lib/data/training.ts`) agrega: control Premium, verificación de contenido completo y persistencia con la sesión del usuario (RLS y triggers validan otra vez).

## Reglas configurables por versión

```jsonc
"entryRequirements": { "minWeeklyKm": 15, "minExperienceMonths": 6, "minAge": 18, "notes": "" },
"progressionRules": {
  "minComplianceToAdvance": 0.6,      // ≥ 60 %: avanzar
  "repeatWeekBelowCompliance": 0.4,   // < 40 %: sugerir repetir
  "reviewAboveAvgRpe": 8.5,           // RPE medio mayor: revisión
  "reviewOnPainReport": true,         // dolor reportado: revisión
  "maxWeeklyVolumeIncreasePct": 15    // advertencia de publicación
},
"startWeekRules": [{ "minWeeklyKm": 30, "startWeek": 3 }]
```

## Formato de importación de planes (admin → “Importar contenido (JSON)”)

```json
{
  "weeks": [{ "weekNumber": 1, "focus": "Base", "notes": "" }],
  "sessions": [{
    "weekNumber": 1, "sessionNumber": 1, "type": "easy_run", "title": "Rodaje fácil",
    "objective": "…", "durationS": 2400, "distanceM": null, "intensity": "low",
    "rpeMin": 3, "rpeMax": 4, "warmup": "…", "mainSet": "…", "cooldown": "…",
    "notes": "", "progressionCriteria": "…", "stopCriteria": "…",
    "exercises": [{ "position": 1, "name": "Sentadilla", "sets": 3, "reps": 12, "durationS": null, "restS": 60, "notes": "" }]
  }],
  "scheduleVariants": [{ "code": "v3-a", "label": "Mar · Jue · Sáb", "weekdays": [2, 4, 6], "priority": 0 }]
}
```

`weekdays[i]` es el día ISO (1 = lunes … 7 = domingo) de la sesión `i + 1`.

## Paridad con Flutter

`test-vectors/calculations.json` lo consumen tanto Vitest (`test/pace.test.ts`) como `flutter test` (`apps/mobile/test/pace_vectors_test.dart`). Cualquier cambio de cálculo debe actualizar ambos lados.

## Planes DEMO

`buildDemoPlan(distance, level)` genera estructuras conservadoras basadas en tiempo y RPE (sin ritmos), con progresión gradual, semana de descarga cada 4 y reducción final. Todos pasan `validatePlanVersion` sin errores ni advertencias. Están marcados `isDemo: true`, su nombre empieza con “DEMO” y su objetivo aclara que no constituyen prescripción. **Deben reemplazarse por planes validados por el fundador.**
