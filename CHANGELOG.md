# Cambios

## 2026-10-18 — Administrador: todas las semanas y vista de usuario más clara

- Causa: la vista «ver como usuario» quedaba activa (hasta 12 h) con un aviso poco visible; en esa vista se ve lo mismo que un usuario (con suscripción, las semanas se liberan al empezar un plan). Como administrador la base ya devolvía todas las semanas.
- Aviso fijo arriba de todo en la app y en el panel, con botón para volver; la vista dura como máximo 1 hora.
- Catálogo para suscriptores: «Se libera al empezar el plan» en lugar de «Se libera con la suscripción».
- Pruebas: el admin ve todas las semanas de todos los planes (SQL y E2E en catálogo y Mi plan) y la tira de semanas de la app sin candados.

## 2026-10-18 — Rol de administrador y panel

- La cuenta del dueño tiene rol **admin** (asignado en la base; si la cuenta se vuelve a crear, lo recibe al confirmar el correo).
- El admin tiene acceso total sin suscripción ni cobros.
- Panel en `/admin`: usuarios (totales y nuevos por semana/mes), suscripciones (activas, canceladas, vencidas y por plan), ingresos por mes y moneda, listado de usuarios con correo y búsqueda, distancias objetivo y uso de la calculadora.
- «Ver como usuario» (sin o con suscripción) desde el panel; la base aplica los permisos de esa vista.
- Para cualquier otra cuenta el panel no existe (404); la base lo vuelve a verificar en cada consulta.

## 2026-10-18 — Calculadora de ritmos, planes en km y sin 15 km

- Nueva **Calculadora** en el menú: test (km + tiempo), tabla de ritmos del 100 % al 50 % para las distancias que elijas y calculadora de pasadas. Guarda el último test.
- La parte principal de los entrenamientos se muestra en **km** (con el ritmo del test o el estimado del nivel del plan), en la web y en la app.
- Se quitó la distancia de **15 km** (objetivo, onboarding, planes DEMO y textos). En producción no había usuarios con 15 km.
- La «Vista de ejemplo» de la portada pasó al final de la página.

## 2026-10-17 — Cobros: precio y cotización (PR 1 de 5)

- Precio de lista USD 20/mes y USD 180/año, con el equivalente aproximado en pesos (cotización diaria) y la leyenda «Se cobra en pesos argentinos…».
- Mercado Pago cobra el equivalente en pesos con la cotización vigente.
- Variables `MP_ENV`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `APP_BASE_URL`, `FX_SOURCE`, `FX_RATE_TYPE`, `CRON_SECRET`, validadas al arrancar.
- Tabla `fx_rates` y tarea diaria `/api/cron/diario`.

## 2026-10-15 — Preguntas frecuentes

- Textos nuevos de las preguntas frecuentes de la portada y nueva pregunta «¿Puedo cancelar cuando quiera?».
- Los textos salen de un único archivo (`apps/web/src/i18n/es-AR/faq.ts`) que alimenta la pantalla y los datos estructurados para buscadores (FAQPage).
- Acordeón accesible: botones con `aria-expanded`/`aria-controls`, teclado (Enter, Espacio, flechas, Inicio y Fin) y foco visible.

## 2026-10-15 — Biblioteca de planes 2026.10.1

- Nuevo: plan de 5 km intermedio para bajar la marca (10 semanas, 3, 4 y 5 días por semana; planes 19–21).
- La biblioteca pasa a 21 planes, 354 semanas y 1.752 sesiones.
- Los planes 01–18 no cambian; las inscripciones existentes conservan su versión (`2026.10`).
- Selector: en 5 km cada duración muestra su nivel (Principiante o Intermedio).
- Cálculo de ritmos de 5 km y 3 km a partir de una marca reciente (para los trabajos del plan intermedio).
- Pruebas nuevas: huella de los planes anteriores, totales de los planes nuevos, calendario de 10 semanas y convivencia de versiones en la base.
