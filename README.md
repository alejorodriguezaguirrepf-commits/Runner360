# RUNNER 360

**Entrená. Medí. Progresá.** Plataforma de entrenamiento para corredores (5K a 42K): planes por distancia y nivel,
calendario, registro de entrenamientos, progreso, hidratación, competencias y suscripciones. Interfaz en español (es-AR).

> Estado: **MVP en desarrollo (beta)**. No está listo para producción: faltan revisión de seguridad externa,
> credenciales reales, integración de pagos probada contra los proveedores, revisión legal de los documentos y
> **validación profesional de los planes** (los planes incluidos son DEMO / NO VALIDADO).

## Estructura

```
apps/
  web/                 Next.js 16 (App Router) + TypeScript estricto + Tailwind 4 + Supabase SSR
  mobile/              Flutter 3.47 (Android / iOS)
packages/
  shared/              Dominio, esquemas Zod y formatos es-AR (compartido)
  training-engine/     Motor de entrenamiento puro (sin React/Flutter/Supabase) + pruebas
supabase/
  migrations/          Esquema PostgreSQL versionado con RLS
  seed/                Datos iniciales y planes DEMO (separados de datos reales)
  tests/               Pruebas de seguridad RLS (SQL)
scripts/
  verify-db.sh         Aplica migraciones + seeds + pruebas RLS en un PostgreSQL local
  local-stack/         Backend local compatible con Supabase sin Docker (solo pruebas)
docs/                  Producto, arquitectura, base de datos, seguridad, motor, roadmap y despliegue
```

## Requisitos

- Node.js ≥ 20.9 (probado con 22.22) y pnpm 10
- Un proyecto Supabase (nube) **o** Supabase CLI + Docker para desarrollo local
- PostgreSQL ≥ 15 y `psql` (opcional, para `pnpm db:verify`)
- Flutter 3.47 estable (para la app móvil)

## Instalación

```bash
pnpm install
cp .env.example apps/web/.env.local   # completar valores
```

### Variables de entorno

Ver [`.env.example`](.env.example). Mínimo para que funcione la autenticación:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
Sin ellas la web funciona en modo público y muestra “Autenticación pendiente de configuración” (no simula conexión).
La clave secreta (`SUPABASE_SECRET_KEY`) se usa solo en el servidor (webhooks y baja de cuentas).

## Base de datos: migraciones y seeds

Con Supabase CLI:

```bash
supabase start            # levanta Postgres, Auth, API y Studio locales (requiere Docker)
supabase db reset         # aplica supabase/migrations/* y supabase/seed/*.sql
```

En un proyecto en la nube: `supabase link --project-ref <ref>` y `supabase db push`. Los seeds de demostración
(`supabase/seed/10_demo_plans.sql`) **no** deben cargarse en producción sin decisión explícita.

Regenerar los planes DEMO desde el motor: `pnpm seed:generate`.

Verificación sin Supabase (PostgreSQL local, emula auth.uid() y roles):

```bash
pnpm db:verify            # migraciones + seeds + 53 pruebas de seguridad RLS + idempotencia de seeds
```

## Ejecución local

```bash
pnpm dev                  # http://localhost:3000
```

Sin Docker, existe un backend local de pruebas (PostgreSQL + Supabase Auth + PostgREST + gateway):
`bash scripts/local-stack/start.sh` (ver `docs/DEPLOYMENT.md`). Escribe las variables en `/tmp/runner360-local/env.local`.

Para tener un administrador: registrate y ejecutá en SQL
`insert into public.user_roles (user_id, role) select id, 'admin' from public.profiles where email = 'tu@correo';`

## Pruebas

```bash
pnpm test                                   # Vitest: shared, training-engine y web
pnpm typecheck
pnpm db:verify                              # RLS y reglas de negocio en la base
pnpm --filter @runner360/web build && pnpm e2e          # Playwright sin backend (público + rutas protegidas)
E2E_BACKEND=1 pnpm e2e -- --project=desktop             # flujo completo (app construida con backend local)
cd apps/mobile && flutter analyze && flutter test       # Flutter
```

## Producción

```bash
pnpm --filter @runner360/web build
pnpm --filter @runner360/web start
```

Ver `docs/DEPLOYMENT.md` (Vercel u otro host Node, Supabase, webhooks, plantillas de correo, tiendas móviles).

## Documentación

- [Requisitos de producto](docs/PRODUCT_REQUIREMENTS.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Seguridad y privacidad](docs/SECURITY.md)
- [Motor de entrenamiento](docs/TRAINING_ENGINE.md)
- [Roadmap](docs/DEVELOPMENT_ROADMAP.md)
- [Despliegue](docs/DEPLOYMENT.md)
