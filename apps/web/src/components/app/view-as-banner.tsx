import { stopViewAsAction } from "@/lib/actions/view-as";
import type { ViewAs } from "@/lib/view-as";

/**
 * Aviso fijo arriba de todo mientras el admin ve la app como usuario: es imposible no verlo y
 * siempre tiene a mano el botón para volver.
 */
export function ViewAsBanner({ viewAs }: { viewAs: ViewAs }) {
  return (
    <div role="status" className="sticky top-0 z-40 border-b-2 border-warning bg-warning-bg text-warning">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <p>
          <span className="font-bold">Estás viendo la app como usuario {viewAs === "premium" ? "con suscripción" : "sin suscripción"}.</span>{" "}
          <span>
            {viewAs === "premium"
              ? "Como un suscriptor: las semanas se liberan al empezar un plan."
              : "Solo ves la muestra gratis de cada plan."}{" "}
            Dura como máximo 1 hora.
          </span>
        </p>
        <form action={stopViewAsAction}>
          <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary">Volver a administrador</button>
        </form>
      </div>
    </div>
  );
}
