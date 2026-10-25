# Revisión de planes 2026.11

Revisión completa de los 21 planes en tres fases: auditoría, corrección y reglas automáticas.

| Archivo | Qué tiene |
|---|---|
| [auditoria-2026.10.1.md](auditoria-2026.10.1.md) | Auditoría del contenido anterior: repeticiones, pasadas fuera de lista, trabajo en segundos, volumen e intensidad por plan. |
| [auditoria-2026.11.md](auditoria-2026.11.md) | La misma auditoría sobre el contenido nuevo. |
| [antes-y-despues-2026.11.md](antes-y-despues-2026.11.md) | Km semanales por plan antes y después, sesiones que se repetían y ejemplos de sesiones modificadas. |

## Qué encontró la auditoría (2026.10.1)

- **Sesiones repetidas:** 9 sesiones de calidad iguales a la de la semana anterior, en los planes 14 a 18, 20 y 21. Otras 78 eran casi iguales (misma estructura y ±10 % de volumen).
- **Pasadas fuera de la lista:** 5 × 1200 m, 5 × 1600 m, 2 × 6 km, 2 × 7 km, 2 × 8 km, 2 × 9 km, 2 × 10 km y 4 × 2500 m.
- **Velocidad en segundos:** progresivos de 20" (en entradas en calor y rodajes), cuestas de 20–45" y cambios de 30". Además, pasadas por minutos (umbral, intervalos y caminar-correr).
- **Partes principales en minutos:** 1359 sesiones en lugar de km.
- **Intermedio poco exigente:** 1 sesión de calidad por semana en muchas semanas, nunca más de 2. Volumen de 24,5–39,6 km/semana.

## Reglas (las controla `packages/plan-library/src/quality-rules.ts`)

1. **Sin repeticiones:** ninguna sesión de calidad es igual a una de la semana anterior. Si quedaba igual, progresa:
   - una pasada más (o 0,5 km más) en las semanas de carga;
   - una menos en las descargas y en la puesta a punto.
2. **Distancias de pasadas:** solo 100, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000 y 5000 m.
   - Se elige la distancia y la cantidad de pasadas que mantienen el volumen de la sesión.
   - Ejemplos: 5 × 1200 m pasa a 6 × 1000 m; 2 × 6 km pasa a 3 × 4000 m; 2 × 10 km pasa a 4 × 5000 m.
3. **Nada de velocidad en segundos:** los progresivos y las cuestas pasan a metros (20" pasa a 100 m).
   - Las pausas siguen en tiempo.
   - La entrada en calor y la vuelta a la calma siguen en minutos.
4. **Intermedio más exigente** (decisión del dueño, no de la bibliografía):
   - **Volumen:** cerca de +22 % de km semanales y +20 % de volumen de pasadas.
   - **Calidad:** 2 sesiones por semana de carga y 3 en las semanas pico del bloque específico.
   - **Tirada larga:** en las semanas pico es más larga y lleva tramos a ritmo de 10 km.
   - **Se mantienen** las descargas cada 3–4 semanas y la puesta a punto.
   - **Límites:** el validador exige más volumen que el principiante y no más que el avanzado.
> **Desde 2026.12** los porcentajes se recalibraron a la tabla de RPE del dueño (carrera continua 70 %, pasadas largas 90 %, ritmo de 10 km 95 %, test y ritmo de 5 km 100 %, progresivos 115 %) y no se muestran nombres de esfuerzo: ver [training-plans.md](../training-plans.md#versión-202612-solo-porcentaje-y-rpe). Vista previa en el celular: [vista-previa-2026.12](vista-previa-2026.12/).

5. **Consistencia:** la parte principal va en km y cada intensidad lleva su porcentaje, igual que la Calculadora.
   - El 100 % es el ritmo del test de 5 km.
   - Suave 75–85 %, Umbral 95–100 %, Intenso 105–110 % y progresivos 115 % (el porcentaje sale del corredor modelo de cada capítulo).
   - El test de 30' pasa a ser un test de 5 km.

El validador corre en los tests (`packages/plan-library/test/quality-rules.test.ts`). Falla con:

- una sesión de calidad igual a la de la semana anterior;
- una pasada fuera de la lista;
- trabajo en segundos o por minutos;
- un intermedio con menos volumen que el principiante o con más volumen que el avanzado.

## Cómo se generó

- `pnpm --filter @runner360/plan-library rebuild <json 2026.10.1>` genera la versión `2026.11` desde la anterior. Para obtener la anterior: `git show a74eb2d:content/training-plans/running_plans_library.json`.
- El script recalcula km, minutos por intensidad, totales semanales, rangos de fase, requisitos de entrada y validaciones técnicas.
- Informes:
  - `pnpm --filter @runner360/plan-library audit <json> <informe.md>`
  - `pnpm --filter @runner360/plan-library compare <json anterior> <json nuevo> <informe.md>`

## Usuarios con planes en curso

- El 20/10/2026, en producción, había **0 inscripciones activas** (solo 1 cancelada, en `2026.10.1`). Nadie queda con un plan a medio camino.
- Las inscripciones guardan su `content_version`: una versión nueva no pisa los planes en curso. Quien se inscriba desde ahora usa `2026.11`.
- **Si en el futuro hace falta pasar a alguien a una versión nueva**, la propuesta es una opción en «Mi plan» que diga «Pasar a la versión nueva del plan».
  - Cierra la inscripción actual y crea una nueva en la versión vigente.
  - Mantiene el mismo plan, la misma fecha de inicio y la misma fecha de competencia, así la semana actual no cambia.
  - Los registros y valoraciones ya hechos quedan, porque están atados a fechas.
  - No se haría automáticamente: la elige la persona.
