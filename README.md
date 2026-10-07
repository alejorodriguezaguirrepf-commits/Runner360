# RUNNER 360

**Entrená. Medí. Progresá.** Plataforma de entrenamiento para corredores, de los primeros 5 km a la maratón.
Interfaz en español de Argentina (es-AR). Estado: **beta en desarrollo — no listo para producción** (ver [Pendientes](#estado-y-pendientes)).

| Parte | Tecnología | Ubicación |
|---|---|---|
| Web (landing, app, admin, API) | Next.js 16 (App Router), TypeScript estricto, Tailwind CSS 4 | `apps/web` |
| Móvil (Android / iOS) | Flutter 3.47 / Dart 3.13 | `apps/mobile` |
| Motor de entrenamiento | TypeScript puro + Zod | `packages/training-engine` |
| Esquemas, formato es-AR, tipos | TypeScript + Zod | `packages/shared` |
| Base de datos y seguridad | Supabase (PostgreSQL, Auth, RLS) | `supabase/` |
| Documentación | Markdown | `docs/` |

## Requisitos

- Node.js ≥ 20.9 (probado con 22) y pnpm 10.
- Un proyecto Supabase (nube) **o** un backend local:
  - con Docker: [Supabase CLI](https://supabase.com/docs/guides/local-development) (`supabase start`);
  - sin Docker: `scripts/local-backend/start.sh` (PostgreSQL local + GoTrue + PostgREST; solo desarrollo).
- PostgreSQL 15+ con binarios `initdb`/`pg_ctl`/`psql` para las pruebas SQL.
- Flutter estable para la app móvil (Android SDK / Xcode para compilar en dispositivos).

## Inicio rápido con ícono en el escritorio

Instalá [Node.js LTS](https://nodejs.org) y, para la base de datos local, [Docker Desktop](https://www.docker.com/products/docker-desktop/) (en Linux alcanza con PostgreSQL). Después, una sola vez:

| Sistema | Crear el ícono "RUNNER 360" en el escritorio |
|---|---|
| Windows | doble clic en `scripts\launcher\crear-acceso-directo-windows.bat` |
| macOS | `bash scripts/launcher/crear-acceso-directo-mac.sh` |
| Linux | `bash scripts/launcher/crear-acceso-directo-linux.sh` |

**Sin Docker (Supabase en la nube):** creá un proyecto en supabase.com, pegá en su SQL Editor `supabase/nube/1-estructura.sql` y luego `supabase/nube/2-planes-demo.sql`, y conectalo con el asistente: `scripts\\launcher\\configurar-supabase-nube.bat` en Windows o `node scripts/launcher/configurar-nube.mjs` en Mac/Linux. Los archivos de `supabase/nube/` se regeneran con `pnpm cloud:sql`.

Al hacer doble clic en el ícono, el lanzador (`scripts/launcher/runner360.mjs`) instala dependencias si faltan, levanta la base de datos (Supabase en la nube si `apps/web/.env.local` apunta a ella; si no, Supabase local con Docker; en Linux sin Docker, `scripts/local-backend`), compila solo cuando hay cambios, inicia la app y abre http://localhost:3000. Dejá la ventana abierta mientras la usás; para cerrar, Ctrl+C o cerrá la ventana.

## Instalación

```bash
pnpm install
cp .env.example apps/web/.env.local   # completar valores
```

## Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Dónde | Obligatoria | Uso |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | pública | sí | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | sí | clave publicable (anon) |
| `NEXT_PUBLIC_SITE_URL` | pública | sí | URL base para enlaces de correo |
| `SUPABASE_SERVICE_ROLE_KEY` | **secreta** | para borrar cuentas y webhooks | omite RLS, solo servidor |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | **secretas** | no | suscripciones con Mercado Pago |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **secretas** | no | suscripciones internacionales |

Sin credenciales, la app lo indica explícitamente (“pendiente de configuración”) y no simula conexiones ni pagos.

## Base de datos: migraciones y seeds

- Migraciones versionadas: `supabase/migrations/*.sql`.
- Seeds separados de datos reales: `supabase/seed/` (catálogo de productos, **15 planes DEMO / NO VALIDADOS**, contenido educativo pendiente de revisión).
- El seed de planes DEMO se genera desde el motor: `pnpm seed:generate`.

```bash
# Supabase CLI (Docker)
supabase start            # aplica migraciones y seeds de supabase/seed/*.sql
supabase db reset         # recrea la base local

# Proyecto en la nube
supabase link --project-ref <ref>
supabase db push          # aplica migraciones (los seeds DEMO se cargan aparte, si se desean)

# Sin Docker (solo desarrollo)
bash scripts/local-backend/start.sh   # imprime URL y claves locales
bash scripts/local-backend/stop.sh
```

Para crear el primer administrador, después de registrarte ejecutá en SQL (con un rol con privilegios):

```sql
update public.profiles set role = 'admin', can_validate_plans = true where id = '<uuid del usuario>';
```

## Ejecución local

```bash
pnpm dev                  # http://localhost:3000
```

## Pruebas

```bash
pnpm test                 # Vitest: motor (96), shared (15), web (9)
pnpm typecheck
pnpm lint
pnpm db:test              # PostgreSQL efímero: migraciones + seeds + pruebas de RLS/integridad
cd apps/mobile && flutter analyze && flutter test   # 37 pruebas Dart

# E2E (Playwright) contra una app corriendo con backend:
bash scripts/local-backend/start.sh
pnpm build && DISABLE_RATE_LIMIT=1 pnpm start &
source .local-backend/keys.env
E2E_WITH_BACKEND=1 E2E_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY pnpm test:e2e
```

## Construcción para producción

```bash
pnpm build && pnpm start
```

Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) para despliegue, webhooks y checklist previo al lanzamiento.

## Documentación

- [Requisitos del producto](docs/PRODUCT_REQUIREMENTS.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Seguridad y privacidad](docs/SECURITY.md)
- [Motor de entrenamiento](docs/TRAINING_ENGINE.md)
- [Hoja de ruta](docs/DEVELOPMENT_ROADMAP.md)
- [Despliegue](docs/DEPLOYMENT.md)

## Estado y pendientes

No está listo para producción. Faltan, como mínimo: planes reales validados por el fundador (los actuales son DEMO), credenciales y pruebas reales de pagos (Mercado Pago, Stripe, tiendas), revisión legal de términos y privacidad, revisión de seguridad independiente, monitoreo, y builds firmados de Android/iOS. Detalle en [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md).
