# Arquitectura — RUNNER 360

## Vista general

```
                 ┌───────────────────────────── apps/web (Next.js 16) ─────────────────────────────┐
 Navegador ───►  │ proxy.ts (refresca sesión, 1ª barrera) → layouts (requireSession/requireAdmin)   │
                 │ Server Components (lectura) + Server Actions (escritura, validación Zod)         │
                 │ Route Handlers: /api/v1/* (móvil, Bearer), /api/webhooks/[provider], /api/account │
                 └──────────────┬───────────────────────────────────────────────┬──────────────────┘
                                │ sesión del usuario (RLS)                       │ service_role (solo
                                ▼                                               ▼ webhooks / baja)
 App Flutter ──(JWT, RLS)──► Supabase: Auth (GoTrue) · PostgREST · PostgreSQL con RLS, triggers y funciones
        └──(Bearer)──► /api/v1/plan/enroll (motor en el servidor)
```

## Paquetes

- **`packages/training-engine`**: lógica de negocio pura (sin React, Flutter ni Supabase). Modelos Zod, validación de planes, asignación, calendario, ritmos, cumplimiento, progresión, versionado y punto de extensión de IA. Incluye el generador de planes DEMO y `test-vectors/` compartidos con Dart.
- **`packages/shared`**: esquemas de entrada (formularios/API) en Zod, etiquetas es-AR, formato (km, ritmos, dinero sin floats, fechas, zonas horarias), tipos de filas de la base y mapeadores fila → modelo del motor.
- **Consolidaciones respecto del esquema propuesto** (decisión para evitar complejidad): `packages/types` quedó dentro de `shared` (tipos de filas) y `training-engine` (modelos); `packages/ui` no se creó porque el único consumidor React es la web y Flutter no puede reutilizar componentes React. Los tokens de diseño se replican en `apps/web/src/app/globals.css` y `apps/mobile/lib/src/theme.dart`.

## Decisiones clave

1. **RLS como barrera real.** La UI y el proxy redirigen, pero cada consulta usa la sesión del usuario y PostgreSQL decide qué filas ve o modifica. Las escrituras sensibles (inscripción, calendario, versiones de plan) además tienen triggers de integridad.
2. **Motor único, ejecutado en servidor.** La web lo usa en Server Actions; la app móvil llama a `/api/v1/plan/enroll`, que reutiliza el mismo código (`lib/data/training.ts`). En Dart solo se portan cálculos de presentación (ritmo, duración, km), verificados con los mismos vectores de prueba que TypeScript.
3. **Unidades enteras.** Metros, segundos, mililitros y centavos (`bigint`) evitan errores de punto flotante. El ritmo medio se deriva en una columna generada.
4. **Versionado inmutable de planes.** Las inscripciones apuntan a una `plan_version`; las versiones publicadas/archivadas no se editan (trigger), se clonan.
5. **Pagos desacoplados.** Interfaz `PaymentProvider` con adaptadores Mercado Pago y Stripe vía REST (sin SDK); webhooks verificados por firma e idempotentes por `(provider, provider_event_id)`. Las tiendas móviles se validan en `/api/v1/billing/verify` (pendiente).
6. **Sin dependencia de IA.** `ai.ts` define cómo una IA podría proponer cambios: solo sobre borradores, con validación determinista y aprobación humana obligatoria.
7. **Next.js 16**: `proxy.ts` reemplaza a `middleware.ts`; `cookies()`, `params` y `searchParams` son asíncronos; sin Cache Components (todas las rutas autenticadas son dinámicas).

## Estructura de la web

```
apps/web/src
├─ proxy.ts                     sesión y primera barrera de rutas
├─ app/(marketing)              landing, privacidad, términos
├─ app/(auth)                   ingresar, registro, recuperar, restablecer
├─ app/auth/confirm             enlaces de correo (token_hash / PKCE)
├─ app/onboarding               cuestionario deportivo
├─ app/(app)                    inicio, plan, registrar, progreso, perfil, historial,
│                               hidratación, competencias, aprender, suscripción
├─ app/admin                    panel administrativo
├─ app/api                      v1 (móvil), webhooks, exportación de datos
├─ components                   UI (primitives, form, icons), app (nav, sesiones), charts
└─ lib                          auth, supabase (server/admin/public), data, actions,
                                payments, rate-limit, log, env
```

## App móvil

`apps/mobile/lib`: `config.dart` (dart-define), `theme.dart`, `domain/` (port de cálculos y validación), `data/repository.dart` (Supabase con RLS + API web), `billing/` (interfaz de compras en tiendas), `ui/screens` (ingreso, inicio, plan, registrar, progreso, perfil).
