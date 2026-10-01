# Arquitectura — RUNNER 360

## Vista general

```
             ┌────────────────────┐        ┌──────────────────────────┐
 Navegador → │ apps/web (Next.js) │ ─────→ │ Supabase                 │
             │  · Server Components│  JWT   │  · Auth (GoTrue)         │
             │  · Server Actions   │ (RLS)  │  · PostgREST + Postgres  │
             │  · Route Handlers   │        │  · RLS / triggers / RPC  │
             └─────────┬──────────┘        └──────────▲───────────────┘
                       │ usa                            │ JWT del usuario (RLS)
             ┌─────────▼─────────────┐       ┌─────────┴──────────┐
             │ packages/training-engine│      │ apps/mobile (Flutter)│
             │ packages/shared (Zod)  │      │ lecturas/escrituras  │
             └───────────────────────┘       │ directas + API web   │
                                             └────────────────────┘
```

### Decisiones principales
1. **Monorepo pnpm** con paquetes TypeScript consumidos como fuente (`transpilePackages`): sin pasos de build intermedios.
2. **`packages/types` y `packages/ui` no se crearon**: los tipos se infieren de los esquemas Zod en `packages/shared`
   (una sola fuente de verdad) y la UI web vive en `apps/web/src/components` porque el único consumidor React es la web
   (Flutter no puede reutilizar componentes React). Se pueden extraer cuando exista un segundo consumidor.
3. **Motor de entrenamiento puro** (`packages/training-engine`): funciones deterministas sin dependencias de UI ni de
   base de datos. La web lo usa en el servidor; la app móvil lo invoca indirectamente vía API para no duplicar lógica.
4. **Seguridad en la base**: toda autorización se aplica con RLS, privilegios por columna, triggers y funciones
   `SECURITY DEFINER` con `search_path` vacío. La UI solo oculta lo que el usuario igualmente no podría hacer.
5. **Server Actions + Zod** para todas las escrituras web: validación en el servidor aunque el cliente valide.
6. **Calendario materializado**: al iniciar un plan, el servidor genera las fechas con el motor y las guarda en
   `user_training_calendar` dentro de una transacción (`start_training_plan`). El historial queda ligado a la versión.
7. **Pagos desacoplados**: interfaz `PaymentProvider` (Mercado Pago, Stripe) + procesamiento idempotente de webhooks
   con la clave de servicio. Móvil: interfaz `IapGateway` + verificación en servidor (pendiente).
8. **Sin credenciales no se simula**: la UI muestra “pendiente de configuración” y los endpoints devuelven 503/501.

## Web (apps/web)
- Next.js 16.3 App Router, React 19.3, Tailwind 4.3, TypeScript 5.9 estricto (`noUncheckedIndexedAccess`).
- `src/proxy.ts` (ex middleware): refresca la sesión Supabase y protege `/app`, `/admin`, `/onboarding` (optimista).
- `src/lib/auth.ts`: `requireViewer`, `requireOnboardedViewer`, `requireStaff`, `requireAdmin` (verificación autoritativa).
- `src/lib/data/*`: consultas tipadas y mapeo filas → modelo del motor.
- `src/lib/payments/*`: adaptadores y procesamiento de eventos.
- Rutas: `/` landing, `/calculadora`, `/ingresar`, `/registro`, `/recuperar`, `/restablecer`, `/auth/confirm`,
  `/onboarding`, `/app/*` (inicio, plan, sesión, registrar, historial, progreso, hidratación, competencias,
  aprender, suscripción, perfil), `/admin/*`, `/api/*` (health, export, webhooks, mobile, iap).

## Móvil (apps/mobile)
- Flutter 3.47, Material 3, `supabase_flutter`. Configuración por `--dart-define`.
- Reglas compartidas: cálculos y formatos portados a Dart y verificados con **los mismos vectores JSON** que Vitest
  (`packages/training-engine/fixtures/pace-vectors.json`). Validación de registros equivalente al esquema Zod.

## Diseño
- Tokens: azul marino `#122438`, fondo `#F6F8FA`, verde lima `#D5F36A` (acciones, progreso), blanco, gris `#55657A`.
- Mobile-first, navegación inferior en móvil (Inicio | Plan | Registrar | Progreso | Perfil) y lateral en escritorio.
- Accesibilidad: enlace “Saltar al contenido”, foco visible, `aria-*` en formularios, gráficos con tabla equivalente,
  `prefers-reduced-motion`, iconos SVG (lucide) en lugar de emojis.
- Estados de carga (`loading.tsx`), error (`error.tsx`), vacío (`EmptyState`) y éxito (`Alert`).

## Extensión con IA (futuro)
`PlanSuggestionProvider` + `acceptAiProposal`: cualquier propuesta entra como borrador, pasa la validación
determinista y requiere aprobación humana. El MVP no depende de IA.
