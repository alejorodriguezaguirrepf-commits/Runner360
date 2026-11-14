# Cambios

## 2026-11-14 — Correo de cumpleaños

- El día del cumpleaños (según la fecha de nacimiento del perfil) cada persona recibe un correo de felicitación, alegre y con su nombre, sin mencionar la edad. Cuatro versiones que cambian cada año. Quien nació un 29 de febrero lo recibe el 28 en los años no bisiestos.
- Lo manda la tarea diaria, antes que los demás correos y sin otro correo ese día a la misma persona. Uno por año. Respeta la baja de Perfil → Correos y el link de cada correo (el interruptor ahora dice «correos de motivación y de cumpleaños»).
- Migración 20261114000100 (tipo de envío `birthday` y función `email_birthday_candidates`), aplicada en producción. Privacidad y Perfil actualizados.

## 2026-11-13 — Runnie lee en voz alta y te lleva a las secciones

- **Lectura en voz alta**: un parlante en el encabezado del chat. Activado, Runnie lee cada respuesta con la voz del teléfono o del navegador, en español (gratis); dice las secciones por su nombre en lugar de las rutas. Se apaga al cerrar el chat, al mandar otra pregunta o al usar el micrófono. Queda recordado en el navegador.
- **Te lleva a una sección**: «llevame a Pulsaciones», «abrí el test», «quiero ir a mi progreso», «andá a la pantalla de suscripción»… Runnie contesta y abre la sección (en el celular cierra el chat para que se vea). Si no entiende a cuál, pregunta y muestra las opciones.

## 2026-11-13 — Runnie por voz

- En el chat de Runnie, un botón de micrófono al lado de Enviar: se toca, se dice la pregunta y, al terminar de hablar, se envía sola (el texto se ve mientras se habla). Se vuelve a tocar para cortar.
- Usa el reconocimiento de voz del navegador o del teléfono, en español de Argentina: gratis y sin claves. Donde el navegador no lo ofrece, el micrófono no aparece. Mensajes claros si falta el permiso, no se escuchó nada o no hay conexión.
- Al cerrar el chat se deja de escuchar sin enviar nada. A RUNNER 360 solo le llega el texto; no se graba audio. Política de privacidad actualizada.

## 2026-11-13 — Runnie, gratis para todos

- **Runnie** ahora responde dentro de la app, sin servicios de inteligencia artificial pagos: costo cero y disponible para toda persona con cuenta, con o sin suscripción, sin tope diario de mensajes.
- Entiende las preguntas comunes y responde con la información de la app y con los datos de cada persona: lo que le toca hoy con los ritmos y tiempos según su test, la fuerza del día con su dosis, su plan y semanas liberadas, y (con el consentimiento de datos de salud) su wellness y sus últimas sesiones. Temas: Test/%, cómo anotar tiempos y guardar, wellness, RPE, pulsaciones, PDF, mover días, suscripción y cobros, instalar la app, correos, trote suave, entrada en calor, descanso, cansancio, carrera, y más. Ante dolor o síntomas, primero el aviso de salud.
- Si no entiende, dice con qué puede ayudar y sugiere una nota de Aprender relacionada.
- Las preguntas no salen de RUNNER 360 ni se guardan. Política de privacidad actualizada. Se quita la variable `ANTHROPIC_API_KEY`.
- Runnie deja de figurar entre los beneficios pagos y pasa a la lista del plan gratis (migración 20261113000200).

## 2026-11-13 — Correos de motivación

- **Sin suscripción**: un correo por semana, alegre y alentador, invitando a suscribirse (4 versiones que van rotando).
- **Con suscripción**: un correo cada 15 días alentando a seguir entrenando (4 versiones).
- Los envía la tarea diaria (tope de 90 por día, configurable). Nunca a administradores, a correos sin confirmar ni a cuentas de menos de 2 días.
- **Baja**: link en cada correo (sin iniciar sesión, con confirmación), baja con un toque desde el programa de correo y opción en Perfil → Correos. Los avisos de cuenta y pagos no cambian.
- Requiere un dominio verificado en Resend y `RESEND_FROM` con ese dominio (con el remitente de prueba no se envían).
- Base: `email_preferences` (preferencia y token de baja), `email_sends` (registro de envíos) y funciones para los destinatarios y la baja (migración 20261113000100, aplicada en producción). Política de privacidad actualizada.

## 2026-11-13 — Registro en el mismo plan, con tilde por trabajo

- **El registro se hace en la sesión del plan** (Mi plan y Hoy): debajo de cada trabajo, el tiempo prescripto (con el test), el casillero «Tu tiempo» y un **✓** para darlo por hecho (sin tiempo anotado, queda el prescripto). Lo anotado se guarda en el dispositivo hasta guardar la sesión.
- **Al pie de la sesión**: RPE, FC media y FC máxima (opcionales) y **Guardar**. El registro del día (distancia, duración, RPE, FC y parciales) se arma solo.
- Se quita el botón **Registrar** del menú: en su lugar está **Hoy**. La valoración «¿Cómo te fue?» deja de pedirse en cada día (el historial de valoraciones anteriores se conserva).
- **Tiempos con los dos puntos siempre puestos**: en todos los campos de tiempo se escriben solo números (1320 → 13:20) — registro del plan, Test/%, registro libre, competencias y onboarding.

## 2026-11-12 — «Calculadora» pasa a «Test/%» con parciales automáticos

- La pestaña se llama **Test/%** (menú, título y todos los textos que la nombran).
- Con el test cargado, la tabla calcula sola los parciales del 50 % al 100 % en 100, 150, 200, 300, 400, 500, 600, 700, 800, 1000, 1500, 2000, 3000 y 5000 m (siempre están).
- Se puede agregar cualquier otra distancia: se suma a la tabla y queda guardada en el dispositivo; las agregadas se pueden quitar.

## 2026-11-12 — Registro automático desde el plan: tiempos prescriptos y reales

- Cada entrenamiento del plan (Mi plan y Hoy) tiene **«Tiempos y registro de la sesión»** en dos columnas: **Prescripto** (con el test de la Calculadora, el tiempo de cada pasada o tramo según su porcentaje) y **Real** (para cargar solo lo que no salió como estaba). Las pausas entre pasadas se suman solas.
- Al pie: **RPE de la sesión** y **«Guardar sesión»**. El registro del día se arma solo: distancia, duración total, RPE y los parciales de cada pasada (lo vacío se guarda como estaba prescripto). Se puede actualizar después.
- Sin test cargado no hay tiempos prescriptos: se pueden cargar los reales o guardar con la distancia y la duración estimadas del plan.
- Hoy, antes de guardar, se pide el wellness. Reemplaza al «Finalizar sesión» por km. En el seguimiento, los parciales se muestran por tramo (1000 m, 3 km…).

## 2026-11-12 — Fuerza: siempre 4 series (contenido 2026.14)

- Todos los planes: **4 series por ejercicio** en todas las semanas. Lo que cambia según el momento del plan y la semana son las repeticiones (3 a 6) y la reserva: base 4 × 5 / 4 × 6; desarrollo 4 × 4 / 4 × 6; específico 4 × 3 / 4 × 5; descargas 4 × 5 liviano; puesta a punto 4 × 3–4; semana de competencia 4 × 3 liviana.

## 2026-11-12 — Fuerza: rutinas equilibradas con variación de cargas (contenido 2026.13)

- **Rutinas nuevas** (A principiante, B intermedio, C avanzado), cada una con **dos sesiones de 5 ejercicios**: dos básicos de tren inferior (uno dominante de rodilla y uno de cadera), un auxiliar de tren inferior (de rodilla en la sesión 1 y de cadera en la 2), un empuje y una tracción de tren superior (horizontales en la sesión 1, verticales en la 2).
- **Variación de cargas**: la primera sesión de fuerza de la semana es la pesada y la segunda la liviana. Base 3 × 5 / 3 × 6; desarrollo 4 × 4 / 3 × 6; específico 4 × 3 / 3 × 5; descargas 2 × 5; puesta a punto 2 × 3–4; semana de competencia 2 × 3 liviana. Siempre de 3 a 6 repeticiones y no más de 4 series; la carga se regula con repeticiones en reserva (una más en principiantes).
- **En la app**: cada día con fuerza muestra su sesión desplegable con los 5 ejercicios, el patrón y las series × repeticiones de esa semana; «Fuerza de la semana» en Mi plan y en la ficha del plan (incluye los días sin carrera), y en Hoy, la sesión del día.
- Las rutinas nuevas se ven también en las inscripciones en curso (que conservan su versión de los planes de carrera).
- Los planes (semanas y sesiones de carrera) no cambian: el test lo comprueba contra 2026.12. Migración 20261112000100 (dos columnas en los ejercicios de fuerza), aplicada en producción. El validador exige el equilibrio de cada rutina.

## 2026-11-11 — PDF de la semana: igual que en Mi plan

- El PDF ahora muestra solo los días de entrenamiento, numerados como en la pantalla (Día 1, Día 2…), con km y duración, fecha, «Hecho» si ya se registró, y sus bloques (1. Entrada en calor, 2. Parte principal, 3. Vuelta a la calma) con porcentaje, RPE y ritmo. Se sacan los días de descanso y de solo fuerza, y lo que no aparece en la pantalla (objetivo de la semana, consejos y espacios para completar a mano).

## 2026-11-11 — Semana de entrenamiento en PDF

- En **Mi plan**, junto al resumen de la semana elegida, el botón **Descargar PDF**; también en **Hoy** (tarjeta de la semana). Genera un PDF A4 para guardar o imprimir: plan, semana, fechas, objetivo y criterio para avanzar; cada día con entrada en calor, parte principal y vuelta a la calma (porcentaje, RPE y, si hay test, el ritmo por km), consejo técnico y fuerza; lo ya registrado (km, tiempo, RPE) o espacios para completarlo a mano. Funciona igual en celular y computadora.
- Solo exporta semanas que la persona puede ver en la app. No incluye datos de salud.

## 2026-11-11 — Entrenar con wellness diario, «Finalizar sesión» y seguimiento del entrenador

- **Wellness antes de entrenar**: al abrir el plan (o Hoy), si todavía no se respondió en el día, aparece el cuestionario: sueño, energía, dolor muscular, estrés y ánimo, de 1 a 5 (5 = mejor), una pregunta por pantalla con opciones grandes. Puntaje de 5 a 25 con un consejo para el día y una nota opcional para el entrenador. «Más tarde» lo pospone; vuelve a aparecer la próxima vez que se abre el plan. Se puede editar en el día.
- **Finalizar sesión**: con el wellness hecho, el día de hoy muestra «Finalizar sesión». Paso 1: distancia y tiempo de cada km (o solo el tiempo total), con total y ritmo medio en vivo. Paso 2: RPE de la sesión (1–10) y comentario opcional. Resumen con ritmo medio, km más rápido y carga (RPE × minutos), y acceso a medir el pulso post-carrera. Se puede corregir después.
- **Seguimiento**: en Progreso, «Wellness y carga» (wellness de 14 días, carga semanal, carga de 7 días frente al promedio, detalle por ítem y sesiones con sus parciales). En Administración, nueva pestaña **Deportistas**: cada deportista con wellness de hoy, promedio de 7 días, última sesión y carga; primero los que necesitan atención (wellness bajo, ítems en 1–2, salto de carga, plan en pausa), y la ficha completa de cada uno.
- Base: tabla `wellness_checkins` (migración 20261111000100, aplicada en producción) con RLS: cada persona la suya, el equipo (entrenador / admin) la lee; solo con consentimiento de datos de salud. Los parciales usan la tabla existente `workout_splits`. El wellness se borra con «Borrar mis datos de salud» y se incluye en la exportación de datos. Política de privacidad actualizada.

## 2026-11-10 — Pulsaciones: conteo gigante con el color del logo

- La cuenta regresiva ocupa casi toda la pantalla (de la mitad para abajo) y los latidos y el resultado se ven grandes, en el verde azulado del logo. La parte de arriba, junto a la cámara, queda en blanco para seguir iluminando el dedo.

## 2026-11-10 — Preguntas frecuentes: cómo se cobra

- «¿Cómo se cobran las suscripciones?»: por débito automático a través de Mercado Pago (la mensual se debita sola cada mes; el anual es un pago único por 12 meses, sin renovación automática).

## 2026-11-10 — Portada: Pulsaciones y Calculadora en «Funciones principales»

- Se suman dos funciones a la portada: **Calculadora de ritmos y parciales** (test de distancia y tiempo → ritmos por intensidad y tiempo de cada parcial de las pasadas) y **Pulsaciones con el celular** (dedo en la cámara de adelante, 6" × 10, guardado automático; estimación, no dispositivo médico).

## 2026-11-10 — Pulsaciones: números grandes en pantalla

- Durante el conteo se ven en grande los segundos que quedan y los latidos contados; el resultado (pulsaciones por minuto) también aparece en grande y queda en pantalla al levantar el dedo. Van en la parte de abajo, lejos de la cámara, y sin animaciones para no alterar la luz.

## 2026-11-10 — Pulsaciones: solo con la cámara de adelante y la pantalla como luz

- Queda una sola forma de medir, la que mejor funcionó: **brillo al máximo y yema del índice sobre la cámara de adelante**. Se sacan *Flash* y *Lámpara o ventana* (y su código).
- **Luz más pareja**: mientras la cámara está prendida, toda la pantalla queda en blanco. El estado va abajo, lejos de la cámara, en texto chico y sin animaciones (antes el corazón que latía y la onda cambiaban la luz que atraviesa el dedo y metían ruido).
- **Señal más estable**: se promedia el 80 % de la imagen (el dedo tapa casi toda la cámara de adelante) y se recortan los saltos bruscos de brillo cuando el dedo se acomoda, para que no se cuenten como latidos.
- **Guía en vivo**: si la señal sigue débil, avisa «tapá toda la cámara con la yema, sin apretar, y no muevas la mano».
- Botón **Cerrar** para salir de la luz y ver el historial; «Medir de nuevo» vuelve a prender la cámara. Ayuda y política de privacidad actualizadas.

## 2026-11-10 — Pulsaciones: toma más precisa y opciones sin flash

- **Flash en Android**: se prueban todas las cámaras traseras hasta encontrar la que tiene flash (el navegador solía elegir la gran angular, que no lo tiene).
- **Fuente de luz** elegible y recordada: *Flash*, *Lámpara o ventana* (cámara trasera apuntando a una luz que atraviesa el dedo) o *Pantalla* (cámara de adelante con la mitad de arriba de la pantalla en blanco). Si el flash no se puede prender, pasa sola a lámpara o ventana y lo avisa.
- **Señal más precisa**: se usa el canal de color con el pulso más claro (con flash el rojo se satura y el pulso se ve en el verde), se promedia el centro de la imagen en resolución real (~20.000 píxeles por cuadro), se fijan exposición, balance de blancos y foco con el dedo apoyado, y la pantalla no se apaga mientras se mide.
- **Conteo cuando el pulso está claro**: estabilización mínima de 3"; los 6" de conteo arrancan cuando el pulso se ve claro en dos lecturas seguidas (o a los 8"). Indicador de señal (débil / regular / buena).
- Corregido: con flash, el rojo saturado se tomaba como «apretás demasiado» y cortaba la medición.

## 2026-11-10 — Pulsaciones con la cámara (6" × 10)

- Nueva sección **Pulsaciones** (menú): al abrirla se prenden solos la cámara trasera y el flash. Al apoyar la yema del índice, la app estabiliza 3", cuenta los latidos durante 6" (cuenta regresiva, latidos en vivo y la onda del pulso) y muestra `latidos en 6" × 10 = ppm`. Se guarda sola.
- 100 % automático: si la señal sale inestable recuenta sola (hasta 2 veces) y, si sigue mal, avisa y no guarda; sacar el dedo cancela; levantarlo y volver a apoyarlo mide de nuevo. Tras 90" sin dedo, o al pasar a segundo plano o salir de la sección, se apagan cámara y flash.
- «¿Cómo usarlo?» debajo, abierta la primera vez. Aviso: medición estimativa, no es un dispositivo médico.
- Historial (últimas mediciones) y evolución en reposo. Contexto: en reposo, después de correr u otro.
- «Medir pulso post-carrera» al guardar un entrenamiento (registro libre y sesión del plan), asociado a esa carrera.
- Base: tabla `heart_rate_measurements` (migración 20261110000400, aplicada en producción) con RLS por persona; `bpm` = `beats × 10` lo calcula la base y solo se guardan lecturas de calidad. Las imágenes nunca se guardan ni se envían. Política de privacidad actualizada.

## 2026-11-10 — Ingreso con huella o Face ID (opcional)

- **Ingresar** tiene el botón «Ingresar con huella o Face ID»: entra sin escribir la contraseña con la huella, Face ID, Windows Hello o el bloqueo del dispositivo (llaves de acceso / passkeys).
- **Perfil → Ingreso con huella**: activar en este dispositivo, ver los dispositivos activados (con fecha del último ingreso) y quitarlos. En **Inicio**, una sugerencia de una sola vez para activarlo si el dispositivo lo permite.
- La huella nunca sale del dispositivo: se guarda solo una clave pública por dispositivo (migraciones 20261110000200 y 20261110000300, aplicadas en producción). Desafíos de un solo uso que vencen en 5 minutos, verificación de la persona obligatoria, límite de intentos y registro en la auditoría. Política de privacidad actualizada.

## 2026-11-10 — Runnie entre los beneficios de la suscripción

- «Runnie, tu asistente: respuestas a tus dudas de entrenamiento y de la app» se suma a la lista de la suscripción mensual en la portada y en Suscripción (el anual ya incluye todo lo del mensual). Migración 20261110000100, solo textos del producto, aplicada en producción.

## 2026-11-09 — Runnie, solo con suscripción

- Runnie pasa a ser parte de la suscripción: con suscripción o plan anual, 30 mensajes por día; sin suscripción, el botón sigue visible y al abrirlo invita a suscribirse (no se llama a la API, así que no genera gasto).
- Lo controlan el servidor y la base (migración 20261109000400, aplicada en producción). De paso, con tope 0 ya no se registra ningún mensaje.

## 2026-11-09 — Runnie, el asistente

- **Runnie**: un hombrecito que corre, en la esquina de la app (solo con sesión). Responde dudas sobre cómo usar RUNNER 360 (planes, semana gratis, suscripción, instalar la app) y de running en general, y conoce el plan y la semana de cada persona. Las rutas que menciona (/planes, /suscripcion…) son enlaces.
- Límites: no da indicaciones médicas (ante dolor o síntomas, deriva a un profesional), no inventa datos ni precios y no habla de proveedores técnicos.
- Cupo diario por persona (hora de Argentina): 5 mensajes sin suscripción y 30 con suscripción, controlado por la base (migración 20261109000300, aplicada en producción). Si Runnie no llega a responder, el mensaje no se descuenta.
- El texto de las conversaciones no se guarda en el servidor (queda en la pestaña del navegador); solo se cuenta cuántos mensajes se enviaron. Política de privacidad actualizada.
- Usa la API de Claude (modelo Opus 5.5, esfuerzo bajo, instrucciones en caché y respaldo automático si el modelo declina). Requiere `ANTHROPIC_API_KEY` en Vercel; sin ella, Runnie no aparece.

## 2026-11-09 — Plan gratis más claro: elegí tu plan y entrená la primera semana

- Sin suscripción, **Inicio**, **Mi plan** y **Suscripción** muestran el plan gratis: «Elegí cualquier plan y tenés la semana 1 liberada, día por día», con el botón «Elegir mi plan gratis» (lleva a la biblioteca de planes).
- Ya entrenando con el plan gratis, se aclara qué semana está liberada y que **si quiere seguir entrenando después, tiene que suscribirse**.
- Mismos textos en el catálogo de planes, al empezar un plan y en las semanas con candado.
- Portada: el plan gratis en «Planes y precios» ahora dice qué incluye (migración 20261109000200, solo textos del producto, aplicada en producción).

## 2026-11-09 — Administración: suscripciones y débitos

- Nueva sección **Suscripciones** en el panel de administración (solo admin): distingue quién **compró** (pagó por Mercado Pago), a quién se le **asignó a mano** y quién se anotó pero **nunca pagó**, con estado, último débito, próximo débito (o hasta cuándo tiene acceso) y cantidad y total de débitos aprobados.
- Historial de débitos de cada persona (aprobados, rechazados con su motivo, pendientes y devueltos) y una vista **Todos los débitos**, del más nuevo al más viejo.
- En **Usuarios**, cada persona con suscripción tiene el enlace «Ver suscripción y débitos».
- Base: consultas `admin_subscribers()` y `admin_debits()` (solo lectura, solo admin; migración 20261109000100, aplicada en producción).

## 2026-11-09 — Arreglo de la app instalada en iPhone (Safari y Chrome)

- El service worker ya no intercepta las páginas cuando hay conexión. Safari y Chrome en iPhone rechazaban las páginas con redirección que pasaban por él (por ejemplo, al abrir el ícono sin sesión: /inicio → /ingresar), y la app quedaba en un error. Sin conexión sigue mostrando la página offline.
- Los teléfonos buscan la versión nueva del service worker en cada visita (sin copia guardada), para que el arreglo llegue enseguida.

## 2026-11-09 — Instalar en iPhone desde Instagram y acceso directo para iPhone

- Si la página se abre dentro de **Instagram, Facebook, TikTok u otra app**, la guía lo detecta y muestra primero «Abrila en Safari» (o en Chrome en Android): botón para pasar al navegador, «Copiar enlace» y cómo hacerlo desde el menú de la app. Ahí el teléfono no permite agregar la app a inicio.
- Pasos de Safari actualizados para los iPhone nuevos (el botón Compartir está dentro de «•••») y para Chrome en iPhone.
- **Acceso directo descargable para iPhone** (/acceso-directo?so=ios): un perfil que solo agrega el ícono de RUNNER 360 a la pantalla de inicio.

## 2026-11-05 — Descargá la app (celular y computadora)

- Página pública **runner360.ar/descargar** (también desde la portada y el pie): muestra primero los pasos del dispositivo en el que se está (iPhone, Android o computadora) y los demás plegados.
- En la computadora: botón para instalar donde el navegador lo permite (Chrome y Edge), pasos para Safari (Agregar al Dock) y un **acceso directo descargable** para Windows, Mac o Linux que funciona en cualquier navegador.
- La pantalla «Instalar app» de adentro de la app usa la misma guía.

## 2026-11-03 — Dominio propio runner360.ar

- **Dominio nuevo:** todos los links que arma la app (mails, Mercado Pago, metadatos, sitemap, robots.txt, app móvil) salen de `NEXT_PUBLIC_SITE_URL`; en producción pasa a ser `https://runner360.ar`.
- **Redirección permanente (308)** desde runner360.vercel.app y www.runner360.ar a la misma página de runner360.ar, con ruta y parámetros. La API (webhooks de Mercado Pago y app móvil) y los enlaces de correo ya enviados siguen funcionando en el dominio viejo.
- **Sin volver a ingresar:** quien tenía la sesión iniciada en el dominio viejo pasa una sola vez por `/auth/traspaso`, que la lleva al dominio nuevo con un enlace de un solo uso.
- **App instalada:** el aviso de instalación invita a reinstalarla desde el dominio nuevo.
- Nuevos `robots.txt` y `sitemap.xml`. Pasos de la migración en `docs/DOMINIO.md`.

## 2026-10-30 — Notificaciones de pagos y débitos rechazados

- **Admin:** campana con contador y página de notificaciones (pagos acreditados con detalle de usuario, plan, monto, fecha, primer pago o renovación e ID de Mercado Pago; débitos rechazados; pagos regularizados; accesos cortados), con filtro por tipo y marcar como leídas. Mail y push activables desde el panel.
- **Pagos con problemas:** listado de débitos rechazados con motivo y estado.
- **Usuario:** si falla el débito automático, cartel con el motivo y el botón para actualizar el medio de pago, y push si lo activó. 5 días de gracia mientras Mercado Pago reintenta; si no se cobra, se pausa el acceso y se avisa; si se cobra, se confirma que está todo en orden.
- Sin avisos duplicados aunque Mercado Pago repita el evento.

## 2026-10-25 — Registro en un paso

- **Sin correo de confirmación:** al tocar «Comenzar gratis» se crea la cuenta, la sesión queda iniciada y se pasa a las preguntas del plan. Se quitaron los textos de «revisá tu correo» y «confirmá tu cuenta».
- Si el correo ya tiene cuenta, el aviso ofrece «Ingresá» y «Recuperá tu contraseña».
- **Sugerencia de correo:** si se escribe «gmial.com» (u otro error común), se ofrece corregirlo con un toque.
- **Captcha invisible** (Cloudflare Turnstile) en el registro; las cuentas las crea el servidor después de verificarlo.
- **Rol admin solo desde la base:** se quitó la regla que lo daba por correo y la lista de correos de administrador; ni el panel ni la API pueden darlo.
- App móvil: «Crear cuenta gratis» abre el registro web; el ingreso no cambia.

## 2026-10-25 — Página principal: quién diseña los planes

- Se quitó la tarjeta «Criterio profesional»; las otras dos ocupan el ancho completo.
- «¿Quién diseña los planes?» viene abierta, con el retrato de Alejo Rodríguez Aguirre y su nombre (WebP optimizado).
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
