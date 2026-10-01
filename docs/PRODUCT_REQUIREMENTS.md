# Requisitos de producto — RUNNER 360

## Visión
Plataforma integral de entrenamiento para corredores, desde principiantes que buscan sus primeros 5 km hasta
corredores avanzados que preparan una maratón. Web (escritorio y móvil), Android e iOS. Idioma: español de Argentina.
Moneda inicial: ARS, con soporte para USD.

## Principios
1. **Seguridad del corredor primero**: sin diagnósticos médicos; ante antecedentes de salud → revisión profesional;
   sin base suficiente → fase introductoria.
2. **Metodología administrada por el fundador** (Ciencias del Entrenamiento). El sistema no inventa prescripciones
   ni modifica planes validados: solo sugiere según reglas explícitas y configurables.
3. **Datos reales**: las estadísticas se calculan solo con registros del usuario; todo dato de demostración se rotula DEMO.
4. **Privacidad por diseño**: minimización, consentimiento expreso para salud, exportación y eliminación.

## Modelo comercial
- **Free**: perfil, registro básico, contenido introductorio, planes de demostración.
- **Premium**: planes publicados, calendario, estadísticas avanzadas, hidratación y competencias.
- Precio de referencia: USD 7,99/mes (administrable; no está en el código). Anual: pendiente de definición comercial.
- Futuro: entrenamiento personalizado con entrenador.
- Las funcionalidades por producto se configuran en `subscription_products.features`.

## Alcance del MVP (estado)

| Módulo | Estado |
|---|---|
| A. Autenticación (registro, ingreso, cierre, recuperación, verificación de correo, roles) | Implementado (web) / básico (móvil) |
| B. Onboarding deportivo con consentimiento para datos de salud | Implementado (web) |
| C. Dashboard (próxima sesión, semana, planificado vs. realizado, cumplimiento, progreso a competencia) | Implementado |
| D. Motor y planes (15 combinaciones + fase introductoria, versionado, variantes de días) | Implementado; planes **DEMO / NO VALIDADO** |
| E. Registro de entrenamientos (parciales, FC, desnivel, RPE, estado) | Implementado |
| F. Hidratación (registros, recordatorios configurables, educación) | Implementado; notificaciones push pendientes |
| G. Competencias (objetivo vs. resultado real, parciales, marcas personales, calculadora) | Implementado |
| H. Evolución y estadísticas | Implementado |
| I. Suscripciones (productos, precios, eventos, adaptadores Mercado Pago/Stripe, IAP) | Arquitectura implementada; **pagos pendientes de credenciales** |
| J. Panel administrativo (usuarios, roles, planes, versiones, productos, contenidos, incidencias, auditoría) | Implementado |

## Supuestos documentados
- Edad mínima de uso: 16 años (a confirmar con asesoría legal).
- La semana de entrenamiento empieza el lunes. Un plan comienza el lunes siguiente (o se alinea con la competencia).
- Los planes DEMO son por tiempo (no por distancia) y de intensidad conservadora.
- Los requisitos de ingreso de los planes DEMO son placeholders a revisar por el fundador.
- Zona horaria por defecto: America/Argentina/Buenos_Aires.

## Fuera de alcance del MVP
Integración con relojes/GPS, ubicación, chat con entrenador, IA generativa (solo la interfaz de extensión), notificaciones push.
