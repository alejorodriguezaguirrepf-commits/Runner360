# Cobros con Mercado Pago (débito automático)

> Estado: **PR 1 de 5** (configuración, precio y cotización). Las secciones marcadas *(próximo PR)* se completan en los siguientes.

## Precio

- **Precio de lista:** USD 20 por mes y USD 180 por año. Vive en la tabla `product_prices` (precio sin proveedor, `provider is null`) y se edita desde `/admin` → *Productos y precios*, que guarda el historial (el precio anterior queda inactivo, no se borra).
- **Cobro en pesos:** Mercado Pago Argentina cobra en ARS. El importe en pesos es `precio USD × cotización`, redondeado al peso hacia arriba (`apps/web/src/lib/money.ts`).
- **Una sola fuente:** la portada, la pantalla de suscripción y el checkout leen el mismo precio (`apps/web/src/lib/data/pricing.ts`). Nada de importes escritos en el código (una prueba lo verifica).
- **Leyenda visible:** «Se cobra en pesos argentinos, al equivalente en dólares del día. El valor en pesos es aproximado.» con la fecha de la cotización.

### Cambiar el precio

1. `/admin` → *Productos y precios* → cargá el nuevo importe en USD para el producto. El anterior queda en el historial.
2. Aplica a **altas nuevas**. Las suscripciones existentes conservan su importe: cambiarlo requiere aviso previo (30 días por defecto) y **confirmación explícita del dueño** *(procedimiento en el próximo PR)*.

## Cotización del dólar

| Variable | Valores | Por defecto |
|---|---|---|
| `FX_SOURCE` | `dolarapi` (dólar del Banco Nación, valor de **venta**) · `bcra` (API de Estadísticas Cambiarias del BCRA, mayorista Com. «A» 3500) | `dolarapi` |
| `FX_RATE_TYPE` | Solo `dolarapi`: `oficial`, `mayorista`, `bolsa` (MEP), `contadoconliqui`, `tarjeta`, `blue` | `oficial` |

- Se guarda en `public.fx_rates` (lectura pública, escritura solo del servidor).
- **Actualización diaria:** Vercel Cron llama a `/api/cron/diario` a las 06:00 (hora argentina) — ver `apps/web/vercel.json`. Además, si la cotización tiene más de 26 h, la próxima visita pide una nueva en segundo plano.
- **Si la fuente falla:** se muestra la última cotización válida con su fecha. Si nunca hubo una, se oculta el valor en pesos (el precio en USD se sigue viendo). El checkout intenta obtener una cotización en el momento; si no hay ninguna, pide reintentar en unos minutos.
- La respuesta se valida (formato, moneda y rango): un valor raro se descarta y no se guarda.

## Variables de entorno (Vercel → Project → Settings → Environment Variables)

Solo servidor: ninguna empieza con `NEXT_PUBLIC_`. Nunca se suben al repositorio (ver `.env.example`).

| Variable | Qué es |
|---|---|
| `MP_ENV` | `test` o `prod`. Con esta variable definida la app valida todo al arrancar y **no inicia** si falta algo o si las credenciales no coinciden (por ejemplo, `prod` con un token `TEST-`). |
| `MP_ACCESS_TOKEN` | Access Token de la aplicación de Mercado Pago (*Tus integraciones → Credenciales*). |
| `MP_WEBHOOK_SECRET` | Clave secreta de *Tus integraciones → Webhooks*. |
| `NEXT_PUBLIC_SITE_URL` | `https://runner360.vercel.app` (la URL pública de toda la app; también adonde vuelve Mercado Pago). `APP_BASE_URL` se acepta como nombre anterior. |
| `FX_SOURCE`, `FX_RATE_TYPE` | Ver arriba. |
| `CRON_SECRET` | Secreto de las tareas programadas. Generalo con `openssl rand -hex 32`. Sin él, la tarea diaria no corre (la cotización igual se actualiza con las visitas). |

Se aceptan también los nombres anteriores `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`. Sin `MP_ENV` la app funciona como antes y deja un aviso en el registro.

## Conectar Mercado Pago paso a paso

**Antes:** cuenta de Mercado Pago (vendedor) con la actividad validada. Se trabaja sobre el dominio de producción (`https://runner360.vercel.app`) porque Mercado Pago tiene que poder llegar al webhook (las vistas previas de Vercel están protegidas). Después de cada cambio de variables en Vercel hay que **volver a publicar** (Deployments → último → ⋯ → *Redeploy*).

### 1. Crear la aplicación
1. Entrá a https://www.mercadopago.com.ar/developers/panel → **Tus integraciones** → **Crear aplicación**.
2. Nombre: `RUNNER 360`. Tipo de solución: **Pagos online** → **Suscripciones**. ¿Plataforma de e-commerce? **No**.

### 2. Modo prueba
1. En la aplicación → **Cuentas de prueba** → creá dos: un **vendedor** y un **comprador** (país Argentina). Anotá usuario y contraseña de cada una.
2. Abrí una ventana de incógnito, iniciá sesión en Mercado Pago **con el vendedor de prueba**, entrá a *Tus integraciones* y creá ahí también una aplicación de Suscripciones. En **Credenciales de producción** de esa cuenta copiá el **Access Token** (`APP_USR-…`). Para suscripciones, la cuenta vendedora de prueba se usa con sus credenciales "de producción".
3. **Webhooks** (en la aplicación de la cuenta vendedora de prueba) → **Configurar notificaciones**:
   - URL: `https://runner360.vercel.app/api/webhooks/mercadopago`
   - Eventos: **Planes y suscripciones** (marcá *Suscripciones* y *Pagos recurrentes/autorizados*) y **Pagos** (para el plan anual, que es un pago único).
   - Guardá y copiá la **Clave secreta** que se genera.
4. En Vercel → Project → Settings → **Environment Variables** (entorno *Production*):
   | Variable | Valor |
   |---|---|
   | `MP_ENV` | `test` |
   | `MP_ACCESS_TOKEN` | Access Token del vendedor de prueba (`APP_USR-…`) |
   | `MP_WEBHOOK_SECRET` | Clave secreta del webhook |
   | `NEXT_PUBLIC_SITE_URL` | `https://runner360.vercel.app` |
   | `CRON_SECRET` | una clave larga al azar (`openssl rand -hex 32`) |
   Borrá las variables viejas `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` si existen. **Redeploy.**
5. Comprobá en la app → **Administración → Panel → Estado de integraciones**: *Mercado Pago: Configurado* y, en *Cuenta de Mercado Pago*, «cuenta de prueba. Credenciales válidas.» (la app consulta a Mercado Pago con el token y avisa si el token fue rechazado, si la cuenta no es de Argentina o si no coincide con `MP_ENV`).

### 3. Prueba completa (modo prueba)
1. En la app, creá una cuenta con **el correo del comprador de prueba** (Mercado Pago exige que quien paga sea una cuenta de prueba).
2. **Suscripción** → *Pagar con Mercado Pago*. En Mercado Pago iniciá sesión con el comprador de prueba y pagá con una tarjeta de prueba (Mastercard `5031 7557 3453 0604`, CVV `123`, vencimiento `11/30`, titular `APRO`).
3. Volvés a la app con «Estamos confirmando tu pago». En unos minutos la suscripción aparece activa y en el panel: **Suscripciones → Activas: 1** y el cobro en **Ingresos**.
4. Probá la baja: **Suscripción → Cancelar renovación**. Mantiene el acceso hasta el fin del período.
5. Si algo no llega: en Mercado Pago → Webhooks → *Historial de notificaciones*. Un **401** = la clave secreta no coincide. La "simulación" de notificaciones usa un id inventado y puede responder **500**: es esperable; la prueba válida es una suscripción real de prueba.

### 4. Pasar a producción
1. Con tu cuenta real de Mercado Pago: aplicación → **Credenciales de producción** → completá los datos que pide y copiá el **Access Token** (`APP_USR-…`).
2. En la aplicación real → **Webhooks** → misma URL y mismos eventos → copiá la **nueva clave secreta**.
3. En Vercel: `MP_ENV` = `prod`, `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` con los valores reales. **Redeploy.** (Si `prod` se combina con un token `TEST-`, la app no arranca a propósito.)
4. En el panel, *Cuenta de Mercado Pago* tiene que decir «cuenta real. Credenciales válidas.».
5. Hacé una suscripción real con tu tarjeta desde una cuenta común de la app (no la de administrador, que no paga). Verificá el cobro en Mercado Pago y en el panel, cancelá y devolvé el pago desde Mercado Pago (Actividad → el cobro → *Devolver dinero*).

## Cosas a tener en cuenta

- **El correo tiene que coincidir.** La suscripción mensual se crea con el correo de la cuenta de RUNNER 360 (`payer_email`). Si la persona entra a Mercado Pago con otra cuenta, Mercado Pago puede rechazar el alta. Conviene avisarlo en la pantalla de pago si aparecen casos.
- **Mensual = Suscripciones sin plan** (`/preapproval` con `auto_recurring`): el importe en pesos se fija al momento del alta con la cotización del día.
- **Anual = Checkout Pro** (`/checkout/preferences`): admite cuotas, tarjetas, dinero en cuenta y efectivo.

## Plan anual (pago único por 12 meses)

- Se cobra con **Checkout Pro** (un pago, con cuotas si la persona quiere), en pesos: USD 180 × la cotización del día. **No se renueva solo.**
- El webhook recibe el evento **Pagos** (`payment`), consulta el pago a la API y, si está aprobado, registra un acceso anual de 12 meses. Si la persona renueva antes de que venza, el nuevo año empieza cuando termina el actual. Una devolución o contracargo corta el acceso en ese momento.
- Mientras el anual está vigente, cualquier plan se ve completo desde el inicio, y al terminarlo se puede renovar o elegir otro sin pagar (`enrollment_open_weeks`, migración `20261021000100_annual_plan.sql`). Al vencer, los planes nuevos vuelven a la muestra gratuita; el historial y el plan hecho con el anual se conservan.
- Aviso en la app desde 15 días antes del vencimiento.
- Para pasar del mensual al anual, primero se cancela la renovación mensual (la app no deja tener los dos a la vez).
- En el panel de administración, los suscriptores anuales y sus ingresos aparecen separados de los mensuales.

## Links siempre al dominio de producción

- Correos de confirmación y recuperación, y la vuelta de Mercado Pago, usan siempre `NEXT_PUBLIC_SITE_URL` / `APP_BASE_URL` o, si faltan, el dominio de producción que informa Vercel. Nunca un link de vista previa.
- Si alguien entra por otra dirección del deploy de producción, la app lo redirige a `https://runner360.vercel.app`.
- `https://runner360.vercel.app/api/health` muestra `dominioDeLosEnlaces` y `dominioDeMercadoPago`: los dos tienen que ser `https://runner360.vercel.app`.
- **Vercel → Settings → Deployment Protection:** "Vercel Authentication" en **Standard Protection** (protege solo las vistas previas). Compartí siempre `https://runner360.vercel.app`.
- **Supabase → Authentication → URL Configuration:** *Site URL* = `https://runner360.vercel.app` y en *Redirect URLs* `https://runner360.vercel.app/**`.

## Pendiente en los próximos PR

- *(PR 2)* Script del plan (`preapproval_plan`), alta, ~~verificación de credenciales contra la API~~ (hecho: panel de administración → *Cuenta de Mercado Pago*).
- *(PR 3)* Webhooks en segundo plano, período de gracia, acceso hasta el fin del período, conciliación diaria.
- *(PR 4)* Botón de baja, historial de pagos, actualizar medio de pago.
- *(PR 5)* Panel de administración, prueba de punta a punta en modo prueba y **checklist de producción paso a paso**.
