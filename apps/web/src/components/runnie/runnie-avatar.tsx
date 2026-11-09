/**
 * Runnie: el hombrecito que corre, mascota del asistente. Turquesa de la marca, figura en azul noche
 * (contraste 5,9:1) y vincha y líneas de velocidad en lima. Solo tokens del tema: se ve igual de bien
 * en claro y en oscuro.
 */
export function RunnieAvatar({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className={className}>
      <circle cx="32" cy="32" r="32" className="fill-primary" />
      {/* Líneas de velocidad */}
      <g className="stroke-accent" strokeWidth="2.6" strokeLinecap="round">
        <path d="M7 24h7" />
        <path d="M5 32h8" />
        <path d="M8 40h6" />
      </g>
      {/* Cuerpo, brazos y piernas */}
      <g className="stroke-on-primary" fill="none" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 26 29.5 39" />
        <path d="m33.5 29 7.5 3.5 5-4" />
        <path d="m33.5 29-7.5-1.5-4.5 4.5" />
        <path d="m29.5 39 8 6-2 9" />
        <path d="m29.5 39-5 7.5-8 1" />
      </g>
      {/* Cabeza con vincha, ojos y sonrisa */}
      <circle cx="37" cy="16.5" r="7.5" className="fill-on-primary" />
      <rect x="29.5" y="11.2" width="15" height="3.6" rx="1.8" className="fill-accent" />
      <circle cx="35" cy="18" r="1.2" className="fill-primary" />
      <circle cx="40" cy="18" r="1.2" className="fill-primary" />
      <path d="M35 20.8q2.5 2 5 0" fill="none" className="stroke-primary" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
