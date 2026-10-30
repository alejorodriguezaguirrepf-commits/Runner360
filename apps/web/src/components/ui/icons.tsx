import type { SVGProps } from "react";

/** Íconos de trazo propios (sin dependencias). Decorativos por defecto: aria-hidden. */
type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 3v3M16 3v3" /></Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg {...p}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></Svg>
);
export const IconUser = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>
);
export const IconDrop = (p: IconProps) => (
  <Svg {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></Svg>
);
export const IconFlag = (p: IconProps) => (
  <Svg {...p}><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></Svg>
);
export const IconTimer = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></Svg>
);
export const IconRoute = (p: IconProps) => (
  <Svg {...p}><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></Svg>
);
export const IconBolt = (p: IconProps) => (
  <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>
);
export const IconCheck = (p: IconProps) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></Svg>
);
export const IconInfo = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg {...p}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>
);
export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
);
export const IconBook = (p: IconProps) => (
  <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h14" /></Svg>
);
export const IconStar = (p: IconProps) => (
  <Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></Svg>
);
export const IconList = (p: IconProps) => (
  <Svg {...p}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Svg>
);
export const IconChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
);

/** Figura de un corredor (trazos sobre un cuadro de 32×32). La misma que el ícono de la app. */
export function RunnerMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" fill="#18A999" />
      <g fill="none" stroke="#101C2C" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 10.5 14 17.5" />
        <path d="m16.8 12 3.7 2.6 3.3-1.4" />
        <path d="m16.8 12-3.9-.4-2.6 2.6" />
        <path d="m14 17.5 4.4 3.2-1.3 5.3" />
        <path d="m14 17.5-2.4 4.3-4.6.6" />
      </g>
      <circle cx="19.6" cy="6.6" r="2.6" fill="#101C2C" />
    </svg>
  );
}

/** Logotipo. `inverted` para zonas azul noche (navegación lateral, portada): texto claro y 360 en lima. */
export function Logo({ className = "", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap font-extrabold tracking-tight ${className}`}>
      <RunnerMark />
      <span className={inverted ? "text-nav-ink" : "text-ink"}>
        RUNNER <span className={inverted ? "text-accent" : "text-primary-ink"}>360</span>
      </span>
    </span>
  );
}
export const IconPhone = (p: IconProps) => (
  <Svg {...p}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></Svg>
);
/** Botón Compartir de Safari (cuadrado con flecha hacia arriba). */
export const IconShare = (p: IconProps) => (
  <Svg {...p}><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M8.5 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2.5" /></Svg>
);
/** "Agregar a inicio" de Safari (cuadrado con un +). */
export const IconAddSquare = (p: IconProps) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></Svg>
);
export const IconDots = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="5" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="19" r="1.3" fill="currentColor" /></Svg>
);
