# Despliegue — RUNNER 360

> Ninguna publicación ni contratación de servicios se realizó en esta sesión. Estos son los pasos para hacerlo.

## 1. Supabase
1. Crear proyecto (región cercana a los usuarios, p. ej. São Paulo).
2. `supabase link --project-ref <ref>` y `supabase db push` (migraciones). Cargar `00_products.sql` y
   `20_educational_content.sql`. Los planes DEMO (`10_demo_plans.sql`) solo en staging o con decisión explícita.
3. Auth → URL Configuration: Site URL = dominio web; Redirect URLs: `https://<dominio>/auth/confirm`.
4. Auth → Email Templates (flujo `token_hash`, recomendado para SSR):
   - Confirmación: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - Recuperación: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/restablecer`
5. Activar confirmación de correo, SMTP propio y protección de contraseñas filtradas.
6. Crear el primer admin (SQL en README).

## 2. Web (Next.js)
- Host Node compatible con Next.js 16 (Vercel, Railway, Fly, contenedor propio). Node ≥ 20.9.
- Variables: ver `.env.example`. `NEXT_PUBLIC_*` deben existir **en el build** (se embeben).
- Build: `pnpm install --frozen-lockfile && pnpm --filter @runner360/web build`; start: `pnpm --filter @runner360/web start`.
- Verificar `GET /api/health` (indica qué integraciones están configuradas, sin exponer valores).

## 3. Pagos
- **Mercado Pago**: crear aplicación, obtener `MERCADOPAGO_ACCESS_TOKEN`; configurar webhook
  `https://<dominio>/api/webhooks/mercadopago` (evento “Planes y suscripciones”) y copiar la clave secreta a
  `MERCADOPAGO_WEBHOOK_SECRET`. Crear un precio ARS desde `/admin/productos`.
- **Stripe**: crear producto/price recurrente en USD, cargar el `price_…` en `/admin/productos`;
  webhook `https://<dominio>/api/webhooks/stripe` con eventos `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`; secreto en `STRIPE_WEBHOOK_SECRET`.
- Probar en modo sandbox antes de producción. Los adaptadores **no fueron probados contra las APIs reales**.

## 4. Móvil
- Android: `flutter build appbundle --dart-define=...`; firma con keystore propio (no commitear).
- iOS: `flutter build ipa --dart-define=...` (requiere macOS + Xcode y cuenta Apple Developer).
- Pagos móviles: crear suscripciones en App Store Connect y Google Play Console; implementar `IapGateway` con
  `in_app_purchase` y la verificación en `/api/iap/verify` (App Store Server API / Google Play Developer API).
  Las tiendas exigen su sistema de pagos para contenido digital dentro de la app.

## 5. Entorno local sin Docker (solo pruebas)
`scripts/local-stack/start.sh` levanta PostgreSQL local + Supabase Auth v2.177.0 + PostgREST v12.2.3 + un gateway
mínimo en `http://127.0.0.1:54321`, con confirmación automática de correos y claves JWT de prueba. Requiere los
binarios en `/opt/supa` (`SUPA_BIN`). Es una emulación aproximada: para desarrollo diario usar `supabase start`.
`scripts/local-stack/stop.sh` lo detiene; `start.sh --reset` recrea la base.

## 6. CI sugerido
typecheck → Vitest → `scripts/verify-db.sh` (servicio postgres) → build → Playwright (público) →
opcional: Supabase CLI + Playwright `@backend` → `flutter analyze && flutter test`.
