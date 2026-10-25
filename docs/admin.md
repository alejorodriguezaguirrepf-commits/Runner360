# Administración

## Cómo entro

Iniciá sesión con la cuenta del dueño y entrá a **Administración** en el menú (o directamente a `/admin`). Para cualquier otra cuenta el panel no existe: la página responde 404.

## Rol de administrador

- Columna `profiles.role` (`user` por defecto, `coach`, `admin`). Ningún usuario puede cambiar su propio rol: lo impide el trigger `guard_profile_privileges` (prueba en `supabase/tests/95_admin_owner.sql`).
- El rol admin **solo se cambia directamente en la base** (SQL Editor de Supabase): `update public.profiles set role = 'admin' where id = '…';`. Ni el registro (aunque sea con el correo del dueño), ni el panel, ni la API con la clave de servicio pueden dar o quitar el rol admin: lo impide `guard_profile_privileges` (migración `20261025000100`). La cuenta del dueño ya es admin.
- Desde **Administración → Usuarios → Acciones** solo se cambia entre usuario y entrenador; a una cuenta admin no se le muestra el cambio de rol.
- Toda verificación es del lado del servidor: `requireAdmin()` en cada página del panel y `is_admin()` en la base (RLS y funciones `admin_dashboard()` / `admin_users()`).

## Acceso sin suscripción

`has_premium()` devuelve verdadero para un admin, así que ve todos los planes y funciones pagas en la web y en la app, sin crear suscripciones ni cobros.

## Ver como usuario

Desde el panel: **Sin suscripción** o **Con suscripción**. El servidor guarda la elección en una cookie y manda el encabezado `x-r360-view-as` a la base, que con ese encabezado **le quita** al admin sus permisos (no puede dar permisos a nadie). Arriba de todo queda fijo un aviso con **Volver a administrador** (también en el panel). La vista dura como máximo 1 hora.

- **Sin suscripción:** solo la muestra gratis de cada plan.
- **Con suscripción:** como un suscriptor real: en el catálogo ve la muestra gratis y las demás semanas se liberan mes a mes **al empezar un plan**.
- **Fuera de la vista (administrador):** todas las semanas de todos los planes, inscripto o no (prueba SQL `95_admin_owner.sql` y E2E en `admin.spec.ts`).

## Datos del panel

- Usuarios: `profiles` (cortes por semana y mes en hora argentina).
- Suscripciones: `subscriptions` (sin las otorgadas a mano).
- Ingresos: débitos aprobados de `subscription_payments`, por mes y moneda (nunca se suman monedas distintas).
- Distancias: `training_profiles.target_distance`. Calculadora: `user_pace_tests`.
- Correos: `auth.users`, solo a través de `admin_users()`.

Los cobros se guardan cuando Mercado Pago avisa por webhook. Hace falta configurar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `MP_ENV` en Vercel y cargar el webhook `https://runner360.vercel.app/api/webhooks/mercadopago` en Mercado Pago (ver `docs/payments.md`).
