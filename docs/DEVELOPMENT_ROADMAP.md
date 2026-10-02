# Hoja de ruta — RUNNER 360

## Hecho en la primera sesión (2026-10-02)

- Monorepo pnpm: web Next.js 16, app Flutter, motor de entrenamiento, paquete compartido.
- Esquema PostgreSQL completo con RLS, triggers de integridad, versionado inmutable, auditoría y funciones Premium configurables.
- Flujo vertical web verificado de punta a punta contra un backend Supabase local (GoTrue + PostgREST): landing → registro → onboarding → plan DEMO → calendario → registro de entrenamiento → dashboard → progreso.
- Panel administrativo (usuarios/roles, Premium manual, productos y precios, planes y versiones, contenidos, incidencias, auditoría).
- Hidratación, competencias con calculadora, contenidos educativos, exportación y eliminación de cuenta.
- Arquitectura de pagos (Mercado Pago, Stripe) con firmas e idempotencia — **sin credenciales, no probada contra los proveedores**.
- App Flutter con ingreso, inicio, plan, registro, progreso y perfil.

## Próximo bloque recomendado

1. **Planes reales** (bloqueante para lanzar): el fundador carga y valida los primeros planes con el editor o importación JSON; definir criterios de validación adicionales si hacen falta.
2. **Supabase en la nube**: crear proyecto (región a definir), `supabase db push`, configurar plantillas de correo (enlace a `/auth/confirm?token_hash=…&type=…`), SMTP propio y URLs de redirección. Generar tipos con `supabase gen types`.
3. **Pagos**: cuenta de Mercado Pago (suscripciones/preapproval) y proveedor internacional; precios ARS/USD; probar en sandbox el ciclo completo (alta, renovación, impago, cancelación) y el webhook.
4. **Onboarding y edición de perfil en Flutter**; hidratación y competencias en la app; recordatorios con notificaciones locales.
5. **Compras en tiendas**: `in_app_purchase` + validación server-side en `/api/v1/billing/verify`.
6. **Observabilidad y seguridad**: Sentry, CSP/HSTS, rate limit compartido, MFA para admins, revisión externa de RLS.
7. **Legal**: revisión de términos y privacidad (Ley 25.326 y mercados adicionales).

## Mejoras posteriores

- Reprogramación de sesiones dentro de la semana (solo con variantes validadas).
- Aplicar sugerencias de progresión (p. ej. repetir semana) con confirmación del usuario y regla aprobada.
- Integración con relojes/apps de actividad (requiere consentimiento de ubicación).
- Entrenamiento personalizado: asignación de entrenador a usuarios (`coach_assignments`) y permisos por relación.
- Gráficos adicionales: evolución de ritmos por tipo de sesión, distribución de intensidad.
- Internacionalización (estructura de etiquetas ya centralizada en `packages/shared/src/labels.ts`).
- Funciones de IA detrás de `PlanSuggestionProvider`, siempre con aprobación humana.
