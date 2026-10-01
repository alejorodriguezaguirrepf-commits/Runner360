# Roadmap — RUNNER 360

## Etapa 1 · Fundaciones (completada en esta sesión)
- Monorepo, documentación, esquema de base con RLS, motor de entrenamiento con pruebas.

## Etapa 2 · Flujo vertical web (completada, verificada con backend local)
Landing → registro → onboarding → plan sugerido → calendario → registro de entrenamiento → progreso → panel admin.

## Etapa 3 · Módulos (implementados, con pendientes)
- Hidratación ✔ (pendiente: notificaciones).
- Competencias ✔.
- Suscripciones: arquitectura ✔; pendiente activar credenciales y probar en sandbox.
- Panel admin ✔ (pendiente: editor de ejercicios de fuerza y paginación de usuarios).
- App Flutter: base ✔ (pendiente: onboarding, detalle de sesión, hidratación, competencias, notificaciones, IAP).

## Próximo bloque recomendado
1. **Conectar un proyecto Supabase real** (staging): `supabase db push`, plantillas de correo con `token_hash`,
   SMTP propio, verificación de correo activada. Crear el primer administrador.
2. **Carga de planes reales** por el fundador desde `/admin/planes` (o importador CSV/JSON validado por el motor) y
   definición de requisitos de ingreso y variantes de días validadas.
3. **Pagos en sandbox**: Mercado Pago (precio ARS) y Stripe (USD); definir precio anual.
4. **Despliegue de staging** (Vercel u otro) + CI (GitHub Actions: typecheck, Vitest, `db:verify`, Playwright).
5. **App móvil**: onboarding nativo, detalle de sesión, recordatorios locales de hidratación, `in_app_purchase`.
6. **Endurecimiento**: CSP, rate limit distribuido, monitoreo de errores sin PII, pentest, revisión legal.

## Ideas posteriores
Integración con relojes/Strava (con consentimiento), entrenamiento personalizado con coach, contenidos premium,
asistente de IA sujeto a validación humana, multi-idioma.
