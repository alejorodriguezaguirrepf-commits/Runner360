# Cambios

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
