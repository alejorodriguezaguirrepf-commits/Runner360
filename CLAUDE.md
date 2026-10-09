# RUNNER 360 — instrucciones para Claude

## Flujo de trabajo (obligatorio en todas las sesiones)

- Cuando te pido un cambio, lo implementás completo.
- Antes de subir, corrés build, lint y tests. Si algo falla, lo arreglás; no subís código roto.
- Hacés commit con un mensaje claro en español y push directo a `main` (`git push origin main`).
- Nunca subís secretos, claves ni archivos `.env` al repo (solo `.env.example`, sin valores reales).
- Nunca usás force push ni reescribís el historial (nada de `--force`, `reset --hard`, `rebase` sobre `main`, `commit --amend` de algo ya subido ni borrado de ramas).
- Vercel deploya solo con cada push a `main`: después de subir, verificá que el deploy terminó bien si tenés forma de hacerlo (estado del commit / check runs en GitHub, o `https://runner360.vercel.app/api/health`).
- Al terminar, me das un resumen corto en lenguaje no técnico: qué cambiaste, qué quedó publicado y si hay algo que solo yo puedo hacer (por ejemplo, cargar una variable en Vercel o Supabase).
- Solo me consultás antes de actuar si el cambio puede borrar datos de usuarios, modificar la base de datos de forma irreversible o generar costos.

## Verificación antes de cada push

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test        # training-engine, shared y web (Vitest)
pnpm build       # build de producción de apps/web
```

Si el cambio toca la base (`supabase/`), además `pnpm db:test`. Si toca la app móvil, `flutter analyze` y `flutter test` en `apps/mobile`. Si toca flujos de la web, E2E con `pnpm test:e2e` (requiere backend local: `bash scripts/local-backend/start.sh`).

## Proyecto

- Monorepo pnpm: `apps/web` (Next.js 16 App Router, TS estricto, Tailwind 4), `apps/mobile` (Flutter), `packages/training-engine`, `packages/shared`, `supabase/` (migraciones, seeds, tests SQL), `scripts/`, `docs/`.
- Next.js 16 tiene cambios grandes: leé `apps/web/AGENTS.md` antes de tocar la web (`proxy.ts` reemplaza a middleware, `cookies()`/`params` son async).
- Producción: https://runner360.vercel.app (Vercel, Root Directory `apps/web`). Base de datos y cuentas: Supabase.
- Variables de entorno: ver `.env.example` y `docs/DEPLOYMENT.md`. Se leen en tiempo de ejecución (`apps/web/src/lib/env.ts`).
- Textos de la interfaz en español rioplatense (es-AR). Los mensajes al usuario no mencionan proveedores técnicos.
- Migraciones: nunca editar una ya aplicada; crear una nueva en `supabase/migrations/`. Cambios destructivos (borrar tablas/columnas/datos) requieren consultar antes.
- Planes de entrenamiento DEMO: siempre marcados “DEMO / NO VALIDADO”. No inventar datos, testimonios ni resultados.
