import Image from "next/image";
import pista from "@/assets/equipo/alejo-pista.webp";
import retrato from "@/assets/equipo/alejo-retrato.webp";

/** Respuesta de «¿Quién diseña los planes?»: foto, nombre y el texto de la pregunta frecuente. */
export function DesignerAnswer({ answer }: { answer: string }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <Image
        src={retrato}
        alt="Retrato de Alejo Rodríguez Aguirre, con remera negra y los brazos cruzados, sobre fondo oscuro"
        sizes="(min-width: 640px) 160px, 144px"
        placeholder="blur"
        className="size-36 shrink-0 rounded-3xl object-cover ring-1 ring-line sm:size-40"
      />
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink">Alejo Rodríguez Aguirre</p>
        <p data-faq-answer className="mt-1 text-sm text-muted">{answer}</p>
        <figure className="mt-4 flex items-center gap-3">
          <Image
            src={pista}
            alt="Alejo Rodríguez Aguirre corriendo en una pista de atletismo"
            sizes="64px"
            placeholder="blur"
            className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-line"
          />
          <figcaption className="text-xs text-muted">Entrenando en la pista.</figcaption>
        </figure>
      </div>
    </div>
  );
}
