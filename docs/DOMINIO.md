# Dominio propio: runner360.ar

Producción: **https://runner360.ar**. `www.runner360.ar` y `runner360.vercel.app` redirigen (308) a la misma página.

## Cómo funciona en la app

- Todos los links salen de `NEXT_PUBLIC_SITE_URL` (se lee en tiempo de ejecución; después de cambiarla, *Redeploy*).
- `src/proxy.ts` redirige cualquier otro host de producción al dominio de `NEXT_PUBLIC_SITE_URL`, conservando ruta y parámetros. **No** redirige `/api/*` (webhooks y app móvil) ni `/auth/*` (enlaces de correo ya enviados y traspaso de sesión).
- Las sesiones se guardan por dominio. Si alguien llega al dominio viejo con la sesión iniciada, pasa por `/auth/traspaso`: verifica la sesión, genera un enlace de ingreso de un solo uso (sin mandar correo, requiere `SUPABASE_SERVICE_ROLE_KEY`), lo canjea en `runner360.ar/auth/confirm` y borra la sesión del dominio viejo.
- App instalada desde el dominio viejo: sigue abriendo y termina en runner360.ar (dentro de una pestaña del navegador). El aviso de instalación ofrece reinstalarla desde el dominio nuevo.

## Pasos (en este orden)

1. **Vercel → Project → Settings → Domains:** agregar `runner360.ar` (principal, Production) y `www.runner360.ar` con *Redirect to* `runner360.ar` (308). Dejar `runner360.vercel.app` asignado a Production (la app hace la redirección).
2. **nic.ar → Mis dominios → runner360.ar → Delegaciones:** reemplazar las delegaciones por `ns1.vercel-dns.com` y `ns2.vercel-dns.com` (sin IP). Esperar a que Vercel muestre "Valid Configuration" y el certificado.
3. Recién con `https://runner360.ar` funcionando: **Vercel → Settings → Environment Variables:** `NEXT_PUBLIC_SITE_URL=https://runner360.ar` en Production y Preview (y `APP_BASE_URL`, si existe, con el mismo valor o borrada). *Redeploy*.
4. **Supabase → Authentication → URL Configuration:** Site URL `https://runner360.ar`; Redirect URLs `https://runner360.ar/**` y, durante la transición, `https://runner360.vercel.app/**`.
5. **Mercado Pago → Tus integraciones → (app) → Webhooks:** URL de producción `https://runner360.ar/api/webhooks/mercadopago` (mismos eventos). Las suscripciones nuevas ya vuelven a runner360.ar; las existentes conservan su URL de retorno vieja, que redirige sola.
6. **Cloudflare Turnstile** (si el captcha está activo): agregar `runner360.ar` y `www.runner360.ar` a los hostnames del widget.
7. **Resend** (opcional): para mandar mails desde `@runner360.ar`, verificar el dominio en Resend (registros DNS en Vercel → Domains → runner360.ar → DNS) y cargar `RESEND_FROM`.
8. **App Android:** variable de GitHub `API_BASE_URL` (si existe) = `https://runner360.ar` y volver a generar el APK. Las versiones ya instaladas siguen funcionando porque `/api` no se redirige.
9. Verificar `https://runner360.ar/api/health`: `dominioDeLosEnlaces` y `dominioDeMercadoPago` = `runner360.ar`.
