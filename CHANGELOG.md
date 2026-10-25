# Cambios

## 2026-10-25 — Página principal: quién diseña los planes

- Se quitó la tarjeta «Criterio profesional»; las otras dos ocupan el ancho completo.
- «¿Quién diseña los planes?» viene abierta, con el retrato de Alejo Rodríguez Aguirre, su nombre y una foto chica entrenando en la pista (WebP optimizado).
- Nueva respuesta de «¿Necesito experiencia previa?», en primera persona.

## 2026-10-25 — Aprender e Hidratación sin carteles de revisión

- Se quitaron los carteles «Pendiente de revisión profesional» de Aprender, de cada artículo y de las recomendaciones de Hidratación.
- En su lugar, un único aviso breve al pie: «Contenido informativo. No reemplaza la consulta con un profesional de la salud.»
- La marca de revisión profesional queda solo como dato interno del panel de administración.

## 2026-10-25 — Sesiones con porcentaje y RPE (contenido 2026.12)

- **Solo porcentaje y RPE:** cada tramo muestra su intensidad como «75 % · RPE 5», sin nombres como umbral, rodaje, suave o tempo, en todos los planes y distancias. Con el test de la Calculadora cargado, también el ritmo por km.
- **Tramos que no tenían porcentaje** ahora lo tienen: entrada en calor y vuelta a la calma, progresivos, cuestas, caminatas, tests y competencias.
- **Nueva forma de ver cada sesión** (web y app): encabezado con día, km y duración; tres bloques (Entrada en calor, Parte principal, Vuelta a la calma) con color por intensidad, una línea por tramo y su pausa.
- **Ayuda del RPE** a un toque, con la tabla de equivalencias.
- El validador de los planes controla que cada tramo tenga porcentaje y que no aparezcan nombres de esfuerzo.
- Las vistas previas de Vercel ya no actualizan la biblioteca de planes de producción.
- Planes DEMO anteriores: «Rodaje fácil» pasa a «Carrera continua» (también «Carrera continua larga», «Carrera continua exigente» y «Carrera continua corta»), en la web y en la app.

## 2026-10-21 — Acceso desde el link, app instalable y plan anual

- **Acceso desde el link:**
  - Los correos de confirmación y recuperación y la vuelta de Mercado Pago usan siempre el dominio de producción, nunca un link de vista previa.
  - Si alguien entra por otra dirección del deploy de producción, la app lo redirige a runner360.vercel.app.
- **App instalable (PWA):**
  - Ícono en el celular, con íconos para Android e iPhone.
  - Sección «Instalar app» en el menú: botón directo en Android y Chrome, instrucciones con dibujos en iPhone.
  - Aviso la primera vez que se entra desde el celular. Se puede cerrar y no vuelve; si la app ya está instalada, no aparece.
- **Plan anual (USD 180):**
  - Pago único en pesos por 12 meses, sin renovación automática, con el ahorro frente a la mensual (USD 60, 25 %).
  - Mientras está vigente, cualquier plan se ve completo desde el inicio, y al terminarlo se renueva o se elige otro sin pagar.
  - Aviso desde 15 días antes del vencimiento.
  - Al vencer, se conserva el historial.
  - En el panel, los anuales aparecen separados, con sus ingresos.
- La mensual no cambia.

## 2026-10-20 — Revisión completa de los planes (contenido 2026.11)

- **Auditoría** de los 21 planes: sesiones repetidas, pasadas con distancias raras, velocidad en segundos y volumen por nivel (`docs/plan-audit/`).
- **Todos los planes:**
  - las sesiones principales están en km y cada intensidad tiene su porcentaje, igual que en la Calculadora;
  - las pasadas son solo de 100 a 5000 m (lista fija);
  - los progresivos y las cuestas van en metros;
  - el test es de 5 km;
  - ninguna sesión de calidad se repite igual en semanas seguidas.
- **Intermedio más exigente:**
  - alrededor de 22 % más km por semana;
  - 2 sesiones de calidad por semana (3 en las semanas pico, con tirada larga con tramos a ritmo);
  - más volumen de pasadas.
- **Validador automático en los tests:** falla si alguna regla se rompe.
- Las inscripciones en curso conservan su versión (hoy no hay ninguna activa).

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
