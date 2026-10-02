# Despliegue — RUNNER 360

> Ningún entorno fue desplegado todavía. Esta guía describe los pasos; cada uno que implique costos, credenciales o publicación requiere autorización del fundador.

## 1. Supabase

1. Crear el proyecto (elegir región; impacta la política de privacidad).
2. `supabase link --project-ref <ref>` y `supabase db push` para aplicar `supabase/migrations`.
3. Seeds: aplicar `supabase/seed/10_products.sql` (configuración). Los planes DEMO (`20_demo_plans.sql`) y contenidos (`30_…`) son opcionales en producción; si se cargan, quedan marcados como DEMO / pendientes de revisión.
4. Auth:
   - Site URL = dominio web; Redirect URLs: `https://DOMINIO/auth/confirm`.
   - Plantillas de correo (confirmación y recuperación) con enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (o `type=recovery`) y `&next=/onboarding` o `/restablecer`.
   - Contraseña mínima 10 caracteres con letras y números; confirmación de correo activada; SMTP propio.
5. Crear el primer administrador (ver README).

## 2. Web (Next.js)

Cualquier hosting compatible con Next.js 16 (Node.js ≥ 20.9). Variables en el panel del hosting (ver `.env.example`); las secretas nunca con prefijo `NEXT_PUBLIC_`.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Antes de publicar:

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm db:test` y E2E en verde.
- [ ] Encabezados de seguridad (CSP, HSTS, `X-Content-Type-Options`).
- [ ] Limitador de solicitudes compartido si hay varias instancias.
- [ ] Monitoreo de errores.
- [ ] Revisión legal de `/terminos` y `/privacidad` y cambio de la versión en `src/lib/legal.ts`.

## 3. Webhooks de pago

| Proveedor | URL | Variables |
|---|---|---|
| Mercado Pago (suscripciones) | `https://DOMINIO/api/webhooks/mercadopago` | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` |
| Stripe | `https://DOMINIO/api/webhooks/stripe` (eventos `customer.subscription.*`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

Requieren `SUPABASE_SERVICE_ROLE_KEY`. Cargar en `/admin/productos` un precio por proveedor (ARS para Mercado Pago; `provider_price_id` de Stripe). Probar primero en modo sandbox. Los eventos y errores quedan en `/admin/auditoria`.

## 4. App móvil

```bash
cd apps/mobile
flutter build appbundle --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=… --dart-define=API_BASE_URL=…
flutter build ipa        --dart-define=…
```

Pendiente: identificadores definitivos (`com.runner360.runner360`), íconos, firma, fichas de tienda, política de privacidad publicada y compras dentro de la app.
