# Sistema visual RUNNER 360

Fuente única: `apps/web/src/app/globals.css` (tokens de Tailwind 4 en `@theme`, tema oscuro en
`[data-theme="dark"]`). Los componentes usan **solo tokens semánticos**: nunca colores fijos ni
clases de paleta (`navy-*`, `lime-*`, `bg-white`, `text-white`).

## Paleta

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `canvas` | #F5F7FA | #101820 | Fondo general |
| `surface` | #FFFFFF | #1D2C3E | Tarjetas |
| `surface-2` | #EEF2F6 | #25364A | Superficie secundaria (métricas, cajas, chips) |
| `ink` | #101C2C | #F5F7FA | Texto principal |
| `muted` | #5B6B80 | #B8C5D3 | Texto secundario |
| `line` | #E2E8F0 | #344558 | Bordes y separadores |
| `field` | #7B8BA0 | #71859E | Borde de campos (≥ 3:1) |
| `primary` | #18A999 | #18A999 | Acción principal y progreso (texto encima: `on-primary` #101C2C) |
| `primary-ink` | #0A7266 | #3FD0BE | Enlaces y texto turquesa (AA sobre cualquier superficie) |
| `accent` | #D9F36A | #D9F36A | Destacados, objetivos, estado seleccionado (texto: `on-accent`) |
| `nav` / `nav-ink` / `nav-muted` | #101C2C / #F5F7FA / #B8C5D3 | #0B131B / … | Navegación lateral, portada, tarjeta destacada |
| `success`, `warning`, `danger`, `info` (+ `-bg`) | — | — | Estados, siempre con texto o ícono |
| `cat-*` (+ `-bg`) | — | — | Tipos de sesión (descanso, recuperación, suave, moderado, umbral, intenso, competencia) |

Ajuste de marca: el secundario #64748B se oscureció a **#5B6B80** porque sobre #F5F7FA daba 4,43:1
(AA pide 4,5:1). El turquesa #18A999 no se usa como color de texto en el tema claro (2,9:1): para
texto turquesa va `primary-ink`. Contrastes verificados en el encabezado de `globals.css`.

Reglas: turquesa para botones principales, acciones y progreso; lima solo para métricas destacadas,
objetivos, elementos seleccionados y detalles de identidad (nunca para párrafos). Una sola acción
principal por sección.

## Tipografía

Inter (autoalojada con `next/font`, variable `--font-inter`). Escala:

| Uso | Tamaño | Peso |
|---|---|---|
| Título de página (`PageHeader`) | 28–32 px | 800 |
| Título secundario / semana | 22–24 px | 800 |
| Título de tarjeta (`CardTitle`) | 18 px | 700 |
| Texto | 16 px (campos 16 px en móvil para evitar zoom) | 400–600 |
| Etiquetas y datos secundarios | 14 px | 500–600 |
| Auxiliar | 12 px (mínimo) | 600 |

Métricas: `tabular` (cifras tabulares) y 24–28 px en peso 800 (`Stat`, `Metric` del Inicio).

## Temas

- Claro por defecto. Oscuro opcional y **Automático** (sigue al sistema operativo).
- Se elige en **Perfil → Apariencia** (`components/theme/theme-switcher.tsx`) y se recuerda en el
  dispositivo (`localStorage` "r360-theme").
- `THEME_SCRIPT` (en `<head>` del layout raíz) aplica `data-theme` antes de pintar: sin destello.
- `prefers-reduced-motion` reduce animaciones y transiciones a ~0.

## Componentes base (`components/ui`)

- `Button` / `ButtonLink`: `primary` (turquesa), `secondary`, `ghost`, `danger`, `inverse` (zonas
  azul noche). Alto mínimo 44 px; estados hover, foco visible, deshabilitado y "pendiente".
- `Card` (radio 16 px, borde discreto, sin sombra; `tone="dark"` = tarjeta destacada azul noche),
  `CardTitle`, `PageHeader`, `Badge`, `Alert`, `Stat`, `ProgressBar`, `EmptyState`.
- Formularios (`components/ui/form.tsx`): etiqueta visible, error asociado (`aria-describedby`),
  foco turquesa, borde `field`.
- Íconos: una sola familia (trazo 2 px, `components/ui/icons.tsx`). Logo: `RunnerMark` (corredor
  azul noche sobre turquesa), igual que los íconos de la app (web, Android, iOS).

## Verificación

Auditoría con axe-core (WCAG 2.0/2.1/2.2 A y AA) en 12 pantallas × 2 temas × 2 tamaños (escritorio
y Pixel 7): sin violaciones, sin desplazamiento horizontal. Capturas en `docs/screenshots/sistema-visual/`.

## App móvil (Flutter)

`apps/mobile/lib/src/theme.dart` replica los mismos tokens con una `ThemeExtension` (`R360Colors.light`
y `R360Colors.dark`); las pantallas los leen con `context.colors` (nunca colores fijos).

- Tema claro por defecto; **Oscuro** y **Automático** desde **Perfil → Apariencia**.
- La elección se guarda en el dispositivo (`shared_preferences`, clave `r360-theme`) y se aplica al
  abrir la app (`theme_controller.dart`, cargado en `main()` antes de dibujar).
- Pruebas: `test/theme_test.dart` (preferencia recordada, paleta, tarjetas en oscuro y selector).
