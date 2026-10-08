# Requisitos del producto — RUNNER 360

**Eslogan:** Entrená. Medí. Progresá. · **Idioma:** es-AR · **Moneda inicial:** ARS (con soporte multi-moneda; precio de referencia USD 7,99/mes).

## Visión

Plataforma integral de entrenamiento para corredores, desde principiantes (primeros 5 km) hasta maratonistas (42,195 km), disponible en web (escritorio y móvil), Android e iOS, con modelo freemium por suscripción mensual/anual y posibilidad futura de entrenamiento personalizado.

La metodología deportiva la administra y valida el fundador (profesional de Ciencias del Entrenamiento) desde el panel administrativo. **El sistema no inventa prescripciones ni modifica planes validados sin reglas explícitas.**

## Usuarios y roles

| Rol | Puede |
|---|---|
| Usuario | Gestionar su perfil, plan, registros, hidratación, competencias y datos personales |
| Entrenador | Lo anterior + ver datos deportivos de usuarios (no datos de salud); validar planes si tiene `can_validate_plans` |
| Administrador | Gestión completa: usuarios, roles, productos, precios, planes, contenidos, incidencias, auditoría |

## Módulos del MVP y estado

| Módulo | Estado | Notas |
|---|---|---|
| A. Autenticación y cuentas | ✅ web · ✅ móvil | Registro, ingreso, cierre, recuperación, confirmación por correo (si está activada), roles, rutas protegidas |
| B. Onboarding deportivo | ✅ web · ⏳ móvil | Datos mínimos, consentimiento expreso para antecedentes de salud, evaluación de seguridad |
| C. Dashboard | ✅ web · ✅ móvil (básico) | Sesión del día, semana, cumplimiento, progreso a la competencia, accesos rápidos |
| D. Planes de entrenamiento | ✅ | Motor independiente, 15 combinaciones DEMO, variantes de días, versionado inmutable |
| E. Registro de entrenamientos | ✅ web · ✅ móvil | Ritmo, velocidad, parciales, FC, desnivel, RPE, estado, sesión asociada |
| F. Hidratación | ✅ web (Premium) | Registro en ml, geles, recordatorios (configuración; notificaciones pendientes en móvil), contenido educativo |
| G. Competencias | ✅ web (Premium) | Objetivo estimado vs. resultado real, parciales, marcas personales, calculadora |
| H. Evolución | ✅ web | Km y tiempo semanal, sesiones, cumplimiento, consistencia, marcas, historial por distancia |
| I. Suscripciones | ✅ estructura · ⏳ cobros | Productos/precios administrables, estados, eventos, idempotencia; proveedores pendientes de credenciales |
| J. Panel administrativo | ✅ | Ver `apps/web/src/app/admin` |

## Reglas de producto no negociables

1. Contenido de demostración siempre etiquetado **DEMO / NO VALIDADO**.
2. Sin testimonios, estadísticas de usuarios, récords ni certificaciones inventados.
3. Sin prescripción universal de agua; recomendaciones orientativas con advertencias.
4. La app no afirma medir el estado de hidratación.
5. Tiempos objetivo = estimaciones; resultados = datos reales informados. Nunca se presentan predicciones como garantía.
6. Si el perfil no tiene base suficiente → fase introductoria o revisión profesional, nunca un plan exigente automático.
7. Si no hay distribución semanal validada para la disponibilidad del usuario → “se necesita configuración profesional”.
8. Una versión de plan publicada no se modifica: se crea otra; el historial de los usuarios se conserva.
9. Sin diagnósticos médicos.
10. Sin botones que aparenten funcionar sin hacerlo: lo no configurado se muestra como “pendiente de configuración”.

## Plan Free vs Premium

| Free | Premium |
|---|---|
| Perfil, registro básico, contenido introductorio | Planes publicados incluidos en la suscripción |
| Plan gratuito o DEMO (5K Principiante) | Calendario de cualquier plan Premium |
| Estadísticas de 4 semanas | Historial y estadísticas avanzadas |
| — | Hidratación y competencias |

Qué funciones son Premium se configura en `app_features` desde administración y se aplica en RLS.

## Supuestos documentados

- Precio de referencia USD 7,99/mes cargado como precio de lista; precio anual y en ARS quedan “a definir”.
- El onboarding se completa en la web en esta primera versión; la app móvil lo indica.
- Edad mínima para asignación automática: 18 años (configurable por plan y en las reglas de evaluación).
