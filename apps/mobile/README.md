# RUNNER 360 · App móvil (Flutter)

Aplicación Android/iOS. Flutter 3.47.5 estable · Dart 3.13.4 (versiones usadas al crear el proyecto).

## Estado

| Funcionalidad | Estado |
|---|---|
| Ingreso / registro (Supabase Auth) | Implementado |
| Inicio con próxima sesión y km semanales | Implementado |
| Plan: calendario por semanas | Implementado (lectura) |
| Iniciar plan sugerido | Implementado vía API web `POST /api/mobile/plans/start` (mismo motor que la web) |
| Registro manual de entrenamientos | Implementado con validación equivalente a Zod |
| Progreso (km por semana, últimos registros) | Implementado |
| Onboarding, privacidad, exportación | Pendiente en móvil: se gestionan desde la web |
| Compras dentro de la app | Interfaz `IapGateway` preparada; integración pendiente (`/api/iap/verify` responde 501) |
| Recordatorios de hidratación (notificaciones locales) | Pendiente |

No se ejecutó la app en un emulador/dispositivo en este entorno (no hay Android SDK ni Xcode). Sí se ejecutaron `flutter analyze` y `flutter test`.

## Ejecutar

```bash
cd apps/mobile
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://TU-PROYECTO.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA \
  --dart-define=API_BASE_URL=https://TU-DOMINIO-WEB
```

Sin `--dart-define` la app muestra “Configuración pendiente” (no simula conexión). Nunca usar la clave de servicio en la app.

## Pruebas

```bash
flutter analyze
flutter test   # usa packages/training-engine/fixtures/pace-vectors.json (los mismos vectores que Vitest)
```

## Reglas compartidas

- Cálculos de ritmo, velocidad, formatos y parseo: `lib/core/format.dart` y `lib/core/metrics.dart`, verificados con los vectores compartidos.
- Validación de registros: `lib/core/validation.dart` (equivalente a `workoutLogSchema`); la base vuelve a validar con CHECK y RLS.
- Selección de planes y generación de calendarios: **no se duplican**; las hace el servidor con `@runner360/training-engine`.
