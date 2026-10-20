# Planes: antes (2026.10.1) y después (2026.11)

Generado por `packages/plan-library/scripts/compare-plans.ts`. Km estimados con el corredor modelo de cada capítulo.

Problemas que detecta el validador (`checkQualityRules`): **2778** antes → **0** después.

## 1. Volumen semanal y sesiones de calidad por plan

| Plan | Distancia · nivel · días | Km/sem antes | Km/sem después | Cambio | Pico antes → después | Calidad/sem antes → después | Máx. calidad/sem |
|---|---|---|---|---|---|---|---|
| plan-01 | 5 km · Principiante · 3 | 13,1 | 13,0 | 0 % | 14,1 → 14,0 | 1,0 → 1,0 | 2 → 2 |
| plan-02 | 5 km · Principiante · 4 | 15,8 | 15,5 | -2 % | 17,3 → 17,0 | 1,0 → 1,0 | 2 → 2 |
| plan-03 | 5 km · Principiante · 5 | 18,3 | 17,8 | -3 % | 20,0 → 19,5 | 1,0 → 1,0 | 2 → 2 |
| plan-04 | 5 km · Principiante · 3 | 12,5 | 12,5 | 0 % | 16,5 → 16,5 | 0,6 → 0,6 | 2 → 2 |
| plan-05 | 5 km · Principiante · 4 | 15,6 | 15,3 | -2 % | 20,2 → 20,0 | 0,6 → 0,6 | 2 → 2 |
| plan-06 | 5 km · Principiante · 5 | 18,0 | 17,7 | -2 % | 23,2 → 23,0 | 0,6 → 0,6 | 2 → 2 |
| plan-07 | 10 km · Intermedio · 3 | 27,1 | 33,2 | +23 % | 33,0 → 41,6 | 1,1 → 2,1 | 2 → 3 |
| plan-08 | 10 km · Intermedio · 4 | 33,9 | 41,6 | +23 % | 42,7 → 52,7 | 1,7 → 2,2 | 2 → 3 |
| plan-09 | 10 km · Intermedio · 5 | 39,6 | 48,4 | +22 % | 50,6 → 61,6 | 1,7 → 2,2 | 2 → 3 |
| plan-10 | 10 km · Intermedio · 3 | 26,9 | 33,0 | +23 % | 34,0 → 46,8 | 0,9 → 2,0 | 2 → 3 |
| plan-11 | 10 km · Intermedio · 4 | 33,4 | 41,0 | +23 % | 42,9 → 53,1 | 1,6 → 2,0 | 2 → 3 |
| plan-12 | 10 km · Intermedio · 5 | 38,9 | 47,4 | +22 % | 50,0 → 61,5 | 1,6 → 2,0 | 2 → 3 |
| plan-13 | 21,1 km · Avanzado · 6 | 73,8 | 73,6 | 0 % | 87,4 → 87,1 | 1,9 → 1,9 | 2 → 2 |
| plan-14 | 21,1 km · Avanzado · 6 | 72,6 | 72,3 | 0 % | 98,4 → 98,3 | 1,9 → 1,9 | 2 → 2 |
| plan-15 | 21,1 km · Avanzado · 6 | 72,1 | 71,9 | 0 % | 105,4 → 105,1 | 1,7 → 1,7 | 2 → 2 |
| plan-16 | 42,195 km · Avanzado · 6 | 89,2 | 89,8 | +1 % | 103,8 → 105,8 | 1,8 → 1,8 | 2 → 2 |
| plan-17 | 42,195 km · Avanzado · 6 | 84,6 | 84,8 | +0 % | 115,0 → 118,6 | 1,8 → 1,8 | 2 → 2 |
| plan-18 | 42,195 km · Avanzado · 6 | 83,8 | 84,2 | +1 % | 123,4 → 124,6 | 1,7 → 1,7 | 2 → 2 |
| plan-19 | 5 km · Intermedio · 3 | 24,5 | 30,1 | +23 % | 29,8 → 39,1 | 1,2 → 2,2 | 2 → 3 |
| plan-20 | 5 km · Intermedio · 4 | 29,9 | 36,6 | +22 % | 36,3 → 47,0 | 2,0 → 2,3 | 2 → 3 |
| plan-21 | 5 km · Intermedio · 5 | 33,5 | 41,0 | +22 % | 40,2 → 51,4 | 2,0 → 2,3 | 2 → 3 |

### Promedio por distancia y nivel

| Distancia | Nivel | Km/sem antes | Km/sem después |
|---|---|---|---|
| 5 km | Principiante | 15,6 | 15,3 |
| 10 km | Intermedio | 33,3 | 40,8 |
| 21,1 km | Avanzado | 72,8 | 72,6 |
| 42,195 km | Avanzado | 85,9 | 86,3 |
| 5 km | Intermedio | 29,3 | 35,9 |

### Km semanales por plan (antes → después)

- **plan-01** (5 km Principiante, 3 días)
  - antes: 11,3 · 13,7 · 14,1 · 13,4
  - después: 11,0 · 14,0 · 14,0 · 13,2
- **plan-02** (5 km Principiante, 4 días)
  - antes: 14,0 · 16,9 · 17,3 · 15,1
  - después: 13,5 · 17,0 · 17,0 · 14,7
- **plan-03** (5 km Principiante, 5 días)
  - antes: 16,2 · 19,6 · 20,0 · 17,3
  - después: 15,5 · 19,5 · 19,5 · 16,7
- **plan-04** (5 km Principiante, 3 días)
  - antes: 11,7 · 11,9 · 12,0 · 9,5 · 10,2 · 11,9 · 12,8 · 9,7 · 13,8 · 15,3 · 16,5 · 15,4
  - después: 10,8 · 12,5 · 12,0 · 9,5 · 9,9 · 12,3 · 12,8 · 9,5 · 14,0 · 14,5 · 16,5 · 15,7
- **plan-05** (5 km Principiante, 4 días)
  - antes: 14,4 · 14,6 · 15,2 · 11,7 · 13,4 · 15,1 · 16,5 · 12,4 · 17,5 · 18,9 · 20,2 · 17,1
  - después: 13,3 · 15,0 · 15,0 · 11,5 · 12,9 · 15,3 · 16,3 · 12,0 · 17,5 · 18,0 · 20,0 · 17,2
- **plan-06** (5 km Principiante, 5 días)
  - antes: 16,6 · 16,8 · 17,9 · 13,4 · 16,1 · 17,8 · 19,2 · 14,6 · 19,8 · 21,7 · 23,2 · 19,5
  - después: 15,3 · 17,0 · 17,5 · 13,0 · 15,4 · 17,8 · 18,8 · 14,0 · 20,0 · 21,0 · 23,0 · 19,7
- **plan-07** (10 km Intermedio, 3 días)
  - antes: 24,9 · 26,3 · 27,6 · 21,6 · 26,4 · 26,7 · 29,0 · 20,0 · 30,1 · 31,5 · 33,0 · 27,7
  - después: 29,7 · 33,8 · 35,3 · 23,2 · 32,2 · 34,5 · 35,1 · 20,5 · 40,8 · 41,6 · 39,8 · 31,5
- **plan-08** (10 km Intermedio, 4 días)
  - antes: 30,2 · 31,5 · 32,9 · 26,0 · 33,9 · 35,4 · 37,4 · 26,6 · 38,3 · 41,0 · 42,7 · 31,5
  - después: 38,1 · 42,2 · 43,7 · 30,2 · 40,4 · 44,5 · 44,4 · 29,4 · 48,5 · 49,6 · 52,7 · 36,0
- **plan-09** (10 km Intermedio, 5 días)
  - antes: 35,7 · 37,0 · 38,3 · 30,7 · 39,3 · 40,8 · 42,9 · 29,8 · 44,6 · 47,3 · 50,6 · 37,7
  - después: 45,0 · 49,1 · 50,6 · 35,6 · 47,4 · 51,5 · 51,3 · 31,8 · 56,4 · 57,5 · 61,6 · 42,9
- **plan-10** (10 km Intermedio, 3 días)
  - antes: 21,0 · 21,8 · 22,6 · 18,6 · 24,6 · 25,9 · 27,3 · 18,4 · 28,4 · 27,5 · 29,8 · 23,9 · 28,0 · 31,7 · 29,3 · 20,6 · 30,9 · 32,3 · 33,8 · 27,6 · 32,9 · 34,0 · 26,7 · 27,7
  - después: 27,0 · 29,5 · 31,9 · 18,3 · 29,3 · 32,3 · 35,2 · 17,5 · 35,2 · 33,9 · 34,1 · 25,5 · 36,4 · 35,2 · 37,8 · 21,4 · 41,8 · 44,3 · 44,8 · 30,2 · 41,8 · 46,8 · 28,3 · 33,5
- **plan-11** (10 km Intermedio, 4 días)
  - antes: 26,4 · 27,2 · 27,9 · 23,2 · 29,0 · 30,6 · 32,5 · 24,3 · 35,9 · 38,1 · 38,2 · 28,4 · 35,1 · 40,8 · 37,3 · 25,8 · 38,3 · 39,4 · 41,9 · 32,0 · 41,5 · 42,9 · 33,8 · 31,5
  - después: 35,4 · 38,4 · 40,8 · 28,2 · 35,4 · 38,1 · 40,2 · 26,0 · 44,4 · 48,4 · 44,9 · 34,4 · 41,6 · 47,4 · 45,0 · 28,8 · 48,0 · 47,6 · 51,4 · 39,6 · 50,8 · 53,1 · 40,5 · 36,0
- **plan-12** (10 km Intermedio, 5 días)
  - antes: 31,9 · 32,6 · 33,4 · 27,9 · 34,5 · 36,0 · 38,0 · 29,0 · 41,4 · 43,6 · 43,7 · 33,1 · 40,6 · 46,3 · 42,8 · 31,3 · 43,8 · 44,9 · 47,4 · 36,8 · 47,8 · 50,0 · 38,5 · 37,7
  - después: 41,8 · 44,9 · 47,7 · 33,6 · 42,4 · 44,5 · 46,6 · 31,5 · 50,9 · 54,8 · 51,3 · 40,4 · 48,0 · 53,8 · 51,5 · 35,2 · 54,4 · 54,0 · 57,8 · 45,1 · 57,8 · 61,5 · 45,4 · 42,9
- **plan-13** (21,1 km Avanzado, 6 días)
  - antes: 70,7 · 75,0 · 75,8 · 54,0 · 77,3 · 80,4 · 83,0 · 59,9 · 85,5 · 87,4 · 66,6 · 70,0
  - después: 70,5 · 74,4 · 75,3 · 54,3 · 77,4 · 80,3 · 83,1 · 59,5 · 85,3 · 87,1 · 66,3 · 69,4
- **plan-14** (21,1 km Avanzado, 6 días)
  - antes: 56,8 · 59,1 · 63,1 · 49,0 · 69,8 · 75,4 · 74,5 · 49,9 · 69,8 · 75,0 · 75,7 · 53,0 · 82,8 · 79,5 · 82,2 · 60,6 · 85,1 · 89,1 · 91,0 · 66,9 · 95,0 · 98,4 · 71,3 · 70,0
  - después: 56,9 · 59,4 · 63,1 · 49,2 · 69,5 · 74,6 · 76,0 · 47,9 · 69,1 · 74,4 · 75,3 · 53,3 · 82,3 · 79,1 · 81,8 · 60,3 · 84,9 · 88,6 · 90,8 · 66,1 · 94,6 · 98,3 · 71,3 · 69,4
- **plan-15** (21,1 km Avanzado, 6 días)
  - antes: 53,4 · 55,8 · 58,2 · 46,9 · 64,3 · 69,8 · 73,1 · 48,8 · 60,5 · 68,9 · 64,0 · 49,4 · 72,1 · 65,4 · 70,4 · 48,4 · 44,5 · 65,0 · 67,7 · 50,9 · 69,8 · 74,9 · 72,6 · 53,0 · 76,3 · 75,7 · 80,6 · 56,9 · 80,0 · 82,3 · 83,7 · 59,9 · 86,3 · 88,3 · 89,3 · 64,0 · 92,5 · 94,9 · 96,8 · 68,9 · 96,2 · 101,5 · 97,2 · 73,6 · 105,4 · 93,8 · 77,0 · 70,0
  - después: 53,3 · 55,9 · 58,4 · 47,0 · 63,9 · 69,5 · 74,6 · 46,8 · 60,6 · 68,3 · 64,1 · 49,7 · 71,4 · 66,3 · 69,7 · 48,6 · 45,1 · 64,2 · 67,2 · 51,2 · 69,3 · 74,3 · 72,1 · 53,3 · 75,8 · 75,3 · 80,1 · 56,3 · 79,6 · 82,4 · 83,8 · 59,3 · 86,4 · 88,3 · 89,1 · 63,3 · 92,6 · 94,8 · 96,3 · 68,3 · 96,3 · 101,1 · 97,3 · 73,3 · 105,1 · 93,8 · 77,3 · 69,4
- **plan-16** (42,195 km Avanzado, 6 días)
  - antes: 85,4 · 87,8 · 91,4 · 63,0 · 91,8 · 95,7 · 99,9 · 71,0 · 103,8 · 103,8 · 81,3 · 96,0
  - después: 85,4 · 87,8 · 91,4 · 62,8 · 92,1 · 96,9 · 105,1 · 70,4 · 103,5 · 105,8 · 81,3 · 95,2
- **plan-17** (42,195 km Avanzado, 6 días)
  - antes: 64,8 · 67,5 · 71,6 · 53,9 · 76,0 · 82,5 · 81,7 · 56,7 · 82,1 · 86,8 · 88,6 · 63,8 · 92,7 · 97,1 · 100,9 · 72,7 · 104,1 · 108,9 · 113,4 · 81,7 · 115,0 · 94,5 · 77,7 · 96,0
  - después: 64,9 · 68,1 · 71,8 · 53,6 · 75,8 · 82,4 · 83,8 · 54,3 · 82,3 · 86,8 · 88,6 · 63,8 · 92,4 · 97,8 · 101,2 · 72,3 · 104,6 · 108,4 · 118,6 · 81,8 · 114,8 · 95,1 · 77,3 · 95,2
- **plan-18** (42,195 km Avanzado, 6 días)
  - antes: 59,5 · 61,0 · 64,6 · 49,8 · 68,4 · 74,0 · 77,3 · 49,9 · 74,0 · 71,3 · 79,2 · 55,4 · 79,4 · 76,4 · 79,6 · 56,1 · 81,7 · 86,4 · 86,9 · 62,0 · 91,1 · 89,6 · 93,9 · 66,8 · 95,3 · 98,1 · 100,7 · 72,7 · 104,0 · 106,8 · 108,8 · 78,1 · 112,4 · 115,4 · 116,5 · 85,5 · 116,9 · 119,7 · 113,9 · 90,3 · 123,4 · 115,0 · 106,5 · 88,8 · 96,0 · 21,4 · 46,3 · 56,0
  - después: 59,8 · 61,4 · 65,1 · 49,4 · 68,3 · 73,8 · 79,4 · 47,1 · 74,0 · 72,4 · 78,9 · 55,1 · 79,3 · 77,6 · 79,5 · 55,5 · 81,8 · 86,4 · 87,1 · 61,8 · 91,2 · 89,6 · 94,6 · 66,8 · 95,2 · 98,8 · 102,4 · 72,3 · 104,1 · 107,9 · 113,1 · 78,3 · 111,6 · 119,9 · 124,6 · 85,3 · 116,6 · 119,4 · 113,6 · 90,3 · 122,6 · 114,8 · 106,6 · 88,8 · 98,2 · 21,4 · 46,1 · 55,6
- **plan-19** (5 km Intermedio, 3 días)
  - antes: 23,0 · 24,4 · 25,7 · 18,4 · 25,6 · 27,3 · 28,9 · 20,6 · 29,8 · 21,4
  - después: 27,2 · 30,8 · 33,3 · 19,5 · 31,8 · 33,4 · 39,1 · 22,4 · 38,3 · 24,9
- **plan-20** (5 km Intermedio, 4 días)
  - antes: 27,4 · 29,0 · 30,9 · 25,1 · 33,2 · 32,3 · 36,3 · 24,2 · 34,9 · 25,9
  - después: 33,9 · 37,1 · 39,7 · 26,4 · 40,4 · 41,6 · 47,0 · 26,8 · 43,6 · 29,8
- **plan-21** (5 km Intermedio, 5 días)
  - antes: 31,3 · 32,9 · 34,8 · 27,4 · 37,1 · 36,2 · 40,2 · 26,6 · 38,0 · 30,5
  - después: 38,4 · 41,5 · 44,1 · 30,3 · 44,9 · 46,0 · 51,4 · 30,7 · 46,5 · 36,2

## 2. Sesiones que se repetían igual a la semana anterior

| Plan | Semana | Antes (igual a la semana anterior) | Después (semana anterior → esta) |
|---|---|---|---|
| plan-14 | 7 | 5 × 2 km en Umbral, pausa 1'30" de trote suave | 5 × 2 km en Umbral (95 %), pausa 1'30" de trote suave → **6 × 2 km en Umbral (95 %), pausa 1'30" de trote suave** |
| plan-15 | 7 | 4 × 2 km en Umbral, pausa 1'30" de trote suave | 4 × 2 km en Umbral (95 %), pausa 1'30" de trote suave → **5 × 2 km en Umbral (95 %), pausa 1'30" de trote suave** |
| plan-16 | 10 | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 2' de trote suave | 6 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 2' de trote suave → **7 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 2' de trote suave** |
| plan-17 | 7 | 5 × 2 km en Umbral, pausa 1'30" de trote suave | 5 × 2 km en Umbral (100 %), pausa 1'30" de trote suave → **6 × 2 km en Umbral (100 %), pausa 1'30" de trote suave** |
| plan-18 | 7 | 4 × 2 km en Umbral, pausa 1'30" de trote suave | 4 × 2 km en Umbral (100 %), pausa 1'30" de trote suave → **5 × 2 km en Umbral (100 %), pausa 1'30" de trote suave** |
| plan-20 | 6 | 5 × 3' a ritmo de 3 km (Intenso), pausa 2' de trote suave | 6 × 600 m a ritmo de 3 km (Intenso, 110 %), pausa 2' de trote suave → **7 × 600 m a ritmo de 3 km (Intenso, 110 %), pausa 2' de trote suave** |
| plan-20 | 7 | 2 × 10' en Umbral, pausa 2' de trote suave | 3 × 1500 m en Umbral (100 %), pausa 2' de trote suave → **4 × 1500 m en Umbral (100 %), pausa 2' de trote suave** |
| plan-21 | 6 | 5 × 3' a ritmo de 3 km (Intenso), pausa 2' de trote suave | 6 × 600 m a ritmo de 3 km (Intenso, 110 %), pausa 2' de trote suave → **7 × 600 m a ritmo de 3 km (Intenso, 110 %), pausa 2' de trote suave** |
| plan-21 | 7 | 2 × 10' en Umbral, pausa 2' de trote suave | 3 × 1500 m en Umbral (100 %), pausa 2' de trote suave → **4 × 1500 m en Umbral (100 %), pausa 2' de trote suave** |

## 3. Ejemplos de sesiones modificadas

| Plan | Semana | Sesión | Antes | Después |
|---|---|---|---|---|
| plan-01 | 1 | R | 20' trote continuo Suave | 2,5 km de trote continuo Suave (85 %) |
| plan-01 | 1 | TL | 22' trote continuo Suave | 3 km de trote continuo Suave (85 %) |
| plan-01 | 2 | CTRL | Test: 30' de trote continuo Suave, sin pausas | Test: 4 km de trote continuo Suave, sin pausas |
| plan-01 | 3 | CR | 25' de trote Suave; desde el minuto 6, 5 × 30" en Moderado con 2' de trote Suave entre cada uno | 3,5 km de trote Suave (85 %); desde el km 1, 5 × 100 m en Moderado (95 %) con 2' de trote Suave entre cada uno |
| plan-01 | 4 | CR | 20' de trote Suave; desde el minuto 6, 3 × 30" en ritmo de carrera (Moderado) con 2' de trote Suave entre cada uno | 2,5 km de trote Suave (85 %); desde el km 1, 3 × 100 m en ritmo de carrera (Moderado, 95 %) con 2' de trote Suave entre cada uno |
| plan-02 | 1 | CA | 22' caminata a paso vivo | 2 km de caminata a paso vivo |
| plan-04 | 1 | CC | 8 × (1' trote + 2' caminata) | 8 × (100 m trote + 2' caminata) |
| plan-04 | 5 | R | 3 × (5' trote + 1' caminata) | 3 × (600 m trote + 1' caminata) |
| plan-04 | 5 | TL | 10' trote + 2' caminata + 8' trote | 1,5 km trote + 2' caminata + 1 km trote |
| plan-04 | 6 | R | 12' trote + 2' caminata + 6' trote | 1,5 km trote + 2' caminata + 1 km trote |
| plan-04 | 9 | CR | 25' de trote Suave; desde el minuto 6, 6 × 1' en Moderado con 2' de trote Suave entre cada uno | 3,5 km de trote Suave (85 %); desde el km 1, 6 × 200 m en Moderado (95 %) con 2' de trote Suave entre cada uno |
| plan-04 | 12 | CR | 25' de trote Suave; desde el minuto 6, 3 × 1' en ritmo de carrera (Moderado) con 2' de trote Suave entre cada uno | 3,5 km de trote Suave (85 %); desde el km 1, 3 × 200 m en ritmo de carrera (Moderado, 95 %) con 2' de trote Suave entre cada uno |
| plan-06 | 9 | REC | 15' trote muy suave | 2 km de trote muy suave (75 %) |
| plan-07 | 1 | UMB | 3 × 8' en Umbral, pausa 2' de trote suave | 4 × 1500 m en Umbral (100 %), pausa 2' de trote suave |
| plan-07 | 1 | R+P → CUE | 25' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 8 × 200 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-07 | 1 | TL | 1h00' continuos en Suave | 11 km continuos en Suave (85 %) |
| plan-07 | 4 | R+P | 20' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 3,5 km en Suave (85 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-07 | 4 | TL | 55' continuos en Suave | 10 km continuos en Suave (85 %) |
| plan-07 | 5 | R+P → INT | 25' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 8 × 400 m a ritmo de 3–5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-07 | 6 | INT | 4 × 4' a ritmo de 3–5 km (Intenso), pausa 3' de trote suave | 5 × 800 m a ritmo de 3–5 km (Intenso, 105 %), pausa 3' de trote suave |
| plan-07 | 6 | R+P → UMB | 25' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 5 × 1000 m en Umbral (100 %), pausa 2' de trote suave |
| plan-07 | 8 | R | 25' continuos en Suave | 4,5 km continuos en Suave (85 %) |
| plan-07 | 8 | CTRL | Test de 30' a la máxima intensidad sostenible (ritmo parejo) | Test de 5 km a la máxima intensidad sostenible (ritmo parejo) |
| plan-07 | 9 | RC | 3 × 2 km a ritmo objetivo de 10 km, pausa 3' de trote suave | 4 × 2 km a ritmo objetivo de 10 km (100 %), pausa 3' de trote suave |
| plan-07 | 9 | TL | 1h20': primeros 1h10' en Suave y últimos 10' en Moderado | 15,5 km: 6,5 km en Suave (85 %) + 3 × 1000 m a ritmo objetivo de 10 km (100 %, pausa 2' de trote suave) + 6 km en Suave |
| plan-07 | 10 | INT | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 2' de trote suave | 7 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-07 | 12 | INT | 5 × 2' a ritmo de 10 km (Intenso), pausa 2' de trote suave | 6 × 400 m a ritmo de 10 km (Intenso, 100 %), pausa 2' de trote suave |
| plan-08 | 1 | R → CUE | 25' continuos en Suave | 8 × 200 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-08 | 10 | UMB | 20' continuos en Umbral | 4 km continuos en Umbral (100 %) |
| plan-10 | 2 | R → UMB | 25' continuos en Suave | 4 × 1500 m en Umbral (100 %), pausa 2' de trote suave |
| plan-10 | 15 | INT | 6 × 3' a ritmo de 3–5 km (Intenso), pausa 1'30" de trote suave | 7 × 600 m a ritmo de 3–5 km (Intenso, 105 %), pausa 1'30" de trote suave |
| plan-11 | 5 | CUE | 8 × 20" en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 10 × 100 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-13 | 1 | UMB | 8 × 1 km en Umbral, pausa 1' de trote suave | 8 × 1000 m en Umbral (95 %), pausa 1' de trote suave |
| plan-13 | 1 | R | 35' continuos en Suave | 6,5 km continuos en Suave (80 %) |
| plan-13 | 1 | UMB | 4 × 2 km en Umbral, pausa 1'30" de trote suave | 4 × 2 km en Umbral (95 %), pausa 1'30" de trote suave |
| plan-13 | 1 | REC | 35' de trote muy suave | 6 km de trote muy suave (70 %) |
| plan-13 | 1 | R+P | 35' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 6,5 km en Suave (80 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-13 | 1 | TL | 1h30' continuos en Suave | 17,5 km continuos en Suave (80 %) |
| plan-13 | 5 | RC | 3 × 3 km a ritmo objetivo de 21,1 km, pausa 2' de trote suave | 3 × 3 km a ritmo objetivo de 21,1 km (95 %), pausa 2' de trote suave |
| plan-13 | 5 | TL | 1h45': primeros 1h30' en Suave y últimos 15' en Moderado | 21 km: primeros 17,5 km en Suave (80 %) y últimos 3,5 km en Moderado (90 %) |
| plan-13 | 6 | UMB | 4 × 2500 m en Umbral, pausa 1'30" de trote suave | 5 × 2 km en Umbral (95 %), pausa 1'30" de trote suave |
| plan-13 | 9 | INT | 6 × 1000 m a ritmo de 5–10 km (Intenso), pausa 2' de trote suave | 6 × 1000 m a ritmo de 5–10 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-13 | 10 | RC | 10 km continuos a ritmo objetivo de 21,1 km | 10 km continuos a ritmo objetivo de 21,1 km (95 %) |
| plan-13 | 10 | INT | 5 × 1600 m a ritmo de 10 km (Intenso), pausa 2' de trote suave | 4 × 2 km a ritmo de 10 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-14 | 1 | CUE | 8 × 20" en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 8 × 100 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-14 | 8 | CTRL | Test de 30' a la máxima intensidad sostenible (ritmo parejo) | Test de 5 km a la máxima intensidad sostenible (ritmo parejo) |
| plan-14 | 14 | UMB | 25' continuos en Umbral | 6 km continuos en Umbral (95 %) |
| plan-14 | 19 | R | 1h10' continuos en Suave | 13,5 km continuos en Suave (80 %) |
| plan-14 | 19 | R+P | 1h10' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 13,5 km en Suave (80 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-14 | 20 | CTRL | 3 × 5 km a ritmo objetivo de 21,1 km, pausa 2' de trote suave | 3 × 5 km a ritmo objetivo de 21,1 km (95 %), pausa 2' de trote suave |
| plan-14 | 22 | INT | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 1'30" de trote suave | 6 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 1'30" de trote suave |
| plan-15 | 9 | INT | 5 × 3' a ritmo de 3–5 km (Intenso), pausa 2' de trote suave | 5 × 800 m a ritmo de 3–5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-15 | 14 | CUE | 8 × 1' en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 8 × 200 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-15 | 16 | INT | 4 × 2' a ritmo de 10 km (Intenso), pausa 2' de trote suave | 4 × 500 m a ritmo de 10 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-16 | 1 | UMB | 10 × 1 km en Umbral, pausa 1' de trote suave | 10 × 1000 m en Umbral (100 %), pausa 1' de trote suave |
| plan-16 | 1 | RM | 45' continuos en Suave | 8,5 km continuos en Suave (75 %) |
| plan-16 | 1 | UMB | 5 × 2 km en Umbral, pausa 1'30" de trote suave | 5 × 2 km en Umbral (100 %), pausa 1'30" de trote suave |
| plan-16 | 1 | REC | 35' de trote muy suave | 6 km de trote muy suave (70 %) |
| plan-16 | 1 | R+P | 35' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 6,5 km en Suave (75 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-16 | 1 | TL | 26 km continuos en Suave | 26 km continuos en Suave (75 %) |
| plan-16 | 4 | R | 25' continuos en Suave | 4,5 km continuos en Suave (75 %) |
| plan-16 | 5 | RM | 1h00' continuos en Suave | 11 km continuos en Suave (75 %) |
| plan-16 | 5 | RC | 2 × 6 km a ritmo objetivo de maratón, pausa 3' de trote suave | 3 × 4 km a ritmo objetivo de maratón (90 %), pausa 3' de trote suave |
| plan-16 | 5 | TL | 30 km: los primeros 24 km en Suave y los últimos 6 km a ritmo objetivo de maratón | 30 km: primeros 24 km en Suave (75 %) y últimos 6 km a ritmo objetivo de maratón (90 %) |
| plan-16 | 9 | INT | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 2' de trote suave | 6 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-16 | 9 | R | 1h05' continuos en Suave | 12 km continuos en Suave (75 %) |
| plan-16 | 9 | R+P | 1h05' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 12 km en Suave (75 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-16 | 10 | TL | 28 km: 6 km en Suave + 2 × 10 km a ritmo objetivo de maratón (pausa 3' de trote suave) + 2 km en Suave | 28 km: 6 km en Suave (75 %) + 4 × 5 km a ritmo objetivo de maratón (90 %, pausa 3' de trote suave) + 2 km en Suave |
| plan-17 | 1 | CUE | 8 × 20" en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 8 × 100 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-17 | 8 | CTRL | Test de 30' a la máxima intensidad sostenible (ritmo parejo) | Test de 5 km a la máxima intensidad sostenible (ritmo parejo) |
| plan-18 | 9 | INT | 5 × 3' a ritmo de 3–5 km (Intenso), pausa 2' de trote suave | 5 × 800 m a ritmo de 3–5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-18 | 14 | CUE | 8 × 1' en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 8 × 200 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-18 | 15 | INT | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 1'30" de trote suave | 6 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 1'30" de trote suave |
| plan-18 | 16 | INT | 4 × 2' a ritmo de 10 km (Intenso), pausa 2' de trote suave | 4 × 500 m a ritmo de 10 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-18 | 27 | UMB | 30' continuos en Umbral | 7 km continuos en Umbral (100 %) |
| plan-18 | 37 | RC | 12 km continuos a ritmo objetivo de maratón | 12 km continuos a ritmo objetivo de maratón (90 %) |
| plan-18 | 46 | CA | 25' caminata a paso vivo | 2,5 km de caminata a paso vivo |
| plan-18 | 48 | TL | 1h00' continuos en Suave | 11 km continuos en Suave (75 %) |
| plan-19 | 1 | UMB | 3 × 6' en Umbral, pausa 2' de trote suave | 4 × 1000 m en Umbral (100 %), pausa 2' de trote suave |
| plan-19 | 1 | R+P → CUE | 25' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 8 × 200 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |
| plan-19 | 1 | TL | 55' continuos en Suave | 10,5 km continuos en Suave (85 %) |
| plan-19 | 2 | TL | 1h00' continuos en Suave | 12 km continuos en Suave (85 %) |
| plan-19 | 4 | R | 20' continuos en Suave | 4 km continuos en Suave (85 %) |
| plan-19 | 4 | R+P | 20' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 4 km en Suave (85 %); al final, 6 × 100 m progresivos (Velocidad, 115 %) con 1'40" de trote suave |
| plan-19 | 4 | CTRL | Test de 30' a la máxima intensidad sostenible (ritmo parejo) | Test de 5 km a la máxima intensidad sostenible (ritmo parejo) |
| plan-19 | 6 | INT | 5 × 3' a ritmo de 3 km (Intenso), pausa 2' de trote suave | 6 × 600 m a ritmo de 3 km (Intenso, 110 %), pausa 2' de trote suave |
| plan-19 | 6 | R+P → UMB | 40' en Suave; al final, 6 × 20" progresivos (Velocidad) con 1'40" de trote suave | 5 × 1000 m en Umbral (100 %), pausa 2' de trote suave |
| plan-19 | 7 | INT | 6 × 1000 m a ritmo de 5 km (Intenso), pausa 2' de trote suave | 7 × 1000 m a ritmo de 5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-19 | 9 | INT | 10 × 400 m a ritmo de 3 km (Intenso), pausa 1'30" de trote suave | 12 × 400 m a ritmo de 3 km (Intenso, 110 %), pausa 1'30" de trote suave |
| plan-19 | 10 | INT | 4 × 2' a ritmo objetivo de 5 km (Intenso), pausa 2' de trote suave | 5 × 400 m a ritmo objetivo de 5 km (Intenso, 105 %), pausa 2' de trote suave |
| plan-20 | 1 | CUE | 8 × 20" en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida | 10 × 100 m en subida (pendiente 4–6%), vuelta caminando o trotando al punto de partida |

