# RUNNER 360 — App móvil (Flutter)

Aplicación Android/iOS. Comparte el backend (Supabase + API web) con la versión web.

## Requisitos

- Flutter estable (probado con 3.47.6 / Dart 3.13.5).
- Android SDK / Xcode para compilar en dispositivos (no incluidos en este repositorio).

## Ejecutar

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://PROYECTO.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=CLAVE_PUBLICABLE \
  --dart-define=API_BASE_URL=https://DOMINIO_WEB
```

Sin esas variables la app muestra “Configuración pendiente” y no intenta conectarse.
**Nunca** uses la clave `service_role` en la app.

## Pruebas

```bash
flutter analyze
flutter test
```

`test/pace_vectors_test.dart` ejecuta los mismos vectores de cálculo que el motor TypeScript
(`packages/training-engine/test-vectors/calculations.json`) para garantizar paridad.

## Alcance actual

- Ingreso / registro con Supabase Auth.
- Inicio con entrenamiento del día, plan y calendario (lectura con RLS).
- Asignación de plan vía `POST /api/v1/plan/enroll` (el motor corre en el servidor, no se duplica).
- Registro manual de entrenamientos con validación local equivalente a la del servidor.
- Progreso básico de 4 semanas.

Pendiente: onboarding en la app (hoy se completa en la web), hidratación, competencias,
recordatorios con notificaciones locales y compras dentro de la app (`lib/src/billing`).
