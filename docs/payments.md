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
| `APP_BASE_URL` | `https://runner360.vercel.app` (adonde vuelve Mercado Pago). Si falta, se usa `NEXT_PUBLIC_SITE_URL`. |
| `FX_SOURCE`, `FX_RATE_TYPE` | Ver arriba. |
| `CRON_SECRET` | Secreto de las tareas programadas. Generalo con `openssl rand -hex 32`. Sin él, la tarea diaria no corre (la cotización igual se actualiza con las visitas). |

Se aceptan también los nombres anteriores `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`. Sin `MP_ENV` la app funciona como antes y deja un aviso en el registro.

## Pendiente en los próximos PR

- *(PR 2)* Script del plan (`preapproval_plan`), alta, verificación de credenciales contra la API (`pnpm payments:check`).
- *(PR 3)* Webhooks en segundo plano, período de gracia, acceso hasta el fin del período, conciliación diaria.
- *(PR 4)* Botón de baja, historial de pagos, actualizar medio de pago.
- *(PR 5)* Panel de administración, prueba de punta a punta en modo prueba y **checklist de producción paso a paso**.
